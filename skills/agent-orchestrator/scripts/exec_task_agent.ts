#!/usr/bin/env -S bun --install=fallback

import { defineCommand, runMain } from "citty";
import { consola } from "consola";

type CodexEvent = {
  type?: unknown;
  thread_id?: unknown;
  item?: {
    type?: unknown;
    text?: unknown;
  };
};

function fail(message: string): never {
  consola.error(message);
  process.exit(1);
}

function readRequiredString(value: unknown, optionName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`[error] ${optionName} is required`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function buildCodexArgs(params: { prompt: string; workdir: string; threadId: string }): string[] {
  const { prompt, workdir, threadId } = params;
  const args = ["exec", "--json", "--cd", workdir];

  if (threadId.length > 0) {
    args.push("resume", threadId, prompt);
    return args;
  }

  args.push(prompt);
  return args;
}

async function consumeJsonlAndExtract(params: {
  stream: ReadableStream<Uint8Array>;
  onThreadStarted: (threadId: string) => void;
  onAgentMessage: (message: string) => void;
}): Promise<void> {
  const { stream, onThreadStarted, onAgentMessage } = params;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (rawLine: string): void => {
    const line = rawLine.trim();
    if (line.length === 0) {
      return;
    }

    let parsed: CodexEvent;
    try {
      parsed = JSON.parse(line) as CodexEvent;
    } catch {
      return;
    }

    if (parsed.type === "thread.started" && typeof parsed.thread_id === "string") {
      onThreadStarted(parsed.thread_id);
      return;
    }

    if (
      parsed.type === "item.completed" &&
      parsed.item?.type === "agent_message" &&
      typeof parsed.item.text === "string"
    ) {
      onAgentMessage(parsed.item.text);
    }
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      processLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.length > 0) {
    processLine(buffer);
  }
}

const command = defineCommand({
  meta: {
    name: "exec_task_agent",
    description:
      "Run or resume a task execution agent with `codex exec --json`, then print only thread_id and final agent_message.",
  },
  args: {
    prompt: {
      type: "string",
      required: true,
      description: "Prompt sent to task execution agent",
    },
    "thread-id": {
      type: "string",
      description: "Thread/session id for `codex exec resume`",
    },
    workdir: {
      type: "string",
      default: ".",
      description: "Working directory for task execution agent (`codex exec --cd`)",
    },
  },
  run: async ({ args }) => {
    if (args._.length > 0) {
      fail(`[error] Unknown positional arguments: ${args._.join(", ")}`);
    }

    const prompt = readRequiredString(args.prompt, "--prompt");
    const workdir = readRequiredString(args.workdir, "--workdir");
    const threadId = readOptionalString(args["thread-id"]);

    const codexArgs = buildCodexArgs({ prompt, workdir, threadId });
    const child = Bun.spawn({
      cmd: ["codex", ...codexArgs],
      stdout: "pipe",
      stderr: "ignore",
    });

    if (!child.stdout) {
      fail("[error] failed to read codex exec stdout");
    }

    let capturedThreadId = "";
    let finalAgentMessage = "";

    await consumeJsonlAndExtract({
      stream: child.stdout,
      onThreadStarted: (startedThreadId) => {
        if (capturedThreadId.length === 0) {
          capturedThreadId = startedThreadId;
        }
      },
      onAgentMessage: (message) => {
        finalAgentMessage = message;
      },
    });

    const exitCode = await child.exited;
    if (exitCode !== 0) {
      fail(`[error] codex exec failed with exit code ${exitCode}`);
    }
    if (capturedThreadId.length === 0) {
      fail("[error] thread_id not found in codex json stream");
    }
    if (finalAgentMessage.length === 0) {
      fail("[error] final agent_message not found in codex json stream");
    }

    process.stdout.write(`thread_id=${capturedThreadId}\n`);
    process.stdout.write(finalAgentMessage);
    if (!finalAgentMessage.endsWith("\n")) {
      process.stdout.write("\n");
    }
  },
});

void runMain(command).catch((error) => {
  fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
});

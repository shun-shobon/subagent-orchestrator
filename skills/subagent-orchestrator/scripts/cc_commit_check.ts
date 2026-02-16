#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";

import { defineCommand, runMain } from "citty";
import { consola } from "consola";

function fail(message: string): never {
  consola.error(message);
  process.exit(1);
}

function readOptionalStringOption(value: unknown, optionName: string): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`[error] ${optionName} requires a value`);
  }
  return value;
}

function run(command: string[]): {
  ok: boolean;
  stdout: string;
  stderr: string;
} {
  const proc = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  return {
    ok: proc.exitCode === 0,
    stdout: new TextDecoder().decode(proc.stdout).trimEnd(),
    stderr: new TextDecoder().decode(proc.stderr).trimEnd(),
  };
}

const command = defineCommand({
  meta: {
    name: "cc_commit_check",
    description: "Validate conventional commit message format for the current project.",
  },
  args: {
    file: {
      type: "string",
      description: "Message file path. If omitted, use HEAD commit message.",
    },
  },
  run: ({ args }) => {
    if (args._.length > 0) {
      fail(`[error] Unknown positional arguments: ${args._.join(", ")}`);
    }

    const messageFile = readOptionalStringOption(args.file, "--file");
    let fullMessage = "";
    if (messageFile) {
      if (!existsSync(messageFile)) {
        fail(`[error] message file not found: ${messageFile}`);
      }
      fullMessage = readFileSync(messageFile, "utf-8");
    } else {
      const hasHead = run(["git", "rev-parse", "--verify", "HEAD"]);
      if (!hasHead.ok) {
        const detail = hasHead.stderr || "git rev-parse failed";
        fail(`[error] no commit message source provided and HEAD is unavailable: ${detail}`);
      }
      const latest = run(["git", "log", "-1", "--pretty=%B"]);
      if (!latest.ok) {
        const detail = latest.stderr || "git log failed";
        fail(`[error] failed to read HEAD commit message: ${detail}`);
      }
      fullMessage = latest.stdout;
    }

    if (!fullMessage.trim()) {
      fail("[error] commit message is empty");
    }

    const lines = fullMessage.split(/\r?\n/);
    const subject = lines[0] ?? "";
    const line2 = lines[1] ?? "";
    const body = lines.slice(2).join("\n");

    const subjectMatch = subject.match(
      /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)!?:\s+(.+)$/,
    );
    if (!subjectMatch) {
      fail(
        `[error] invalid subject format:\n  ${subject}\n\nexpected:\n  <type>: <summary>\nor\n  <type>!: <summary>\n\nnote:\n  scope is not allowed.`,
      );
    }

    const summary = subjectMatch[2];
    if (!summary) {
      fail(`[error] invalid subject format: ${subject}`);
    }
    if (summary.length > 40) {
      fail(`[error] summary must be concise (40 chars or less): ${summary}`);
    }

    if (!/[ぁ-んァ-ヶー一-龠々]/u.test(summary)) {
      fail(`[error] summary must include Japanese text: ${summary}`);
    }

    if (line2.trim().length > 0) {
      fail("[error] line 2 must be blank. write details from line 3 onward.");
    }

    if (!body.split(/\r?\n/).some((line) => line.trim().length > 0)) {
      fail("[error] commit body is required from line 3 onward.");
    }

    consola.success("[ok] conventional commit message is valid");
  },
});

void runMain(command).catch((error) => {
  fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
});

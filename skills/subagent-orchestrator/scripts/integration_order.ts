#!/usr/bin/env bun

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { defineCommand, runMain } from "citty";
import { consola } from "consola";

const ALLOWED_STATUS = new Set(["todo", "in_progress", "review", "done", "blocked"]);

type Task = {
  taskId: string;
  deps: string[];
  status: string;
  summary: string;
};

function fail(message: string): never {
  consola.error(message);
  process.exit(1);
}

function readStringOption(value: unknown, optionName: string, required = false): string {
  if (value === undefined) {
    if (required) {
      fail(`[error] ${optionName} is required`);
    }
    return "";
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`[error] ${optionName} requires a value`);
  }
  return value;
}

function parseFrontmatter(path: string): Record<string, unknown> {
  const text = readFileSync(path, "utf-8");
  const lines = text.split(/\r?\n/);
  const firstLine = lines[0];

  if (!firstLine || firstLine.trim() !== "---") {
    throw new Error(`${path}: frontmatter must start with '---'`);
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line?.trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    throw new Error(`${path}: frontmatter end marker '---' is missing`);
  }

  const yamlText = lines.slice(1, endIdx).join("\n");
  const parsed = Bun.YAML.parse(yamlText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path}: frontmatter must be a YAML mapping`);
  }
  return parsed as Record<string, unknown>;
}

function parseDeps(raw: string): string[] {
  const value = raw.trim();
  if (value === "" || value === "-") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readFrontmatterString(params: {
  frontmatter: Record<string, unknown>;
  key: string;
  path: string;
  required?: boolean;
}): string {
  const { frontmatter, key, path, required = false } = params;
  const raw = frontmatter[key];
  if (raw === undefined || raw === null) {
    if (required) {
      throw new Error(`${path}: required field '${key}' is missing`);
    }
    return "";
  }
  if (typeof raw !== "string") {
    throw new Error(`${path}: field '${key}' must be a string`);
  }
  const value = raw.trim();
  if (required && value.length === 0) {
    throw new Error(`${path}: required field '${key}' is empty`);
  }
  return value;
}

function normalizeDeps(raw: unknown, path: string, taskId: string): string[] {
  if (Array.isArray(raw)) {
    const deps: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") {
        throw new Error(`${path}: invalid deps for ${taskId}; deps items must be strings`);
      }
      const dep = item.trim();
      if (dep.length > 0 && dep !== "-") {
        deps.push(dep);
      }
    }
    return deps;
  }
  if (typeof raw === "string") {
    return parseDeps(raw);
  }
  if (raw === undefined || raw === null) {
    return [];
  }
  throw new Error(`${path}: invalid deps for ${taskId}; expected list or comma-separated string`);
}

function loadTasks(tasksDir: string): Map<string, Task> {
  let dirStat;
  try {
    dirStat = statSync(tasksDir);
  } catch {
    throw new Error(`tasks directory not found: ${tasksDir}`);
  }

  if (!dirStat.isDirectory()) {
    throw new Error(`tasks directory not found: ${tasksDir}`);
  }

  const entryNames = readdirSync(tasksDir).sort((a, b) => a.localeCompare(b));
  const taskFiles: string[] = [];

  for (const entryName of entryNames) {
    const taskDir = join(tasksDir, entryName);
    try {
      if (!statSync(taskDir).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const taskFile = join(taskDir, "task.md");
    try {
      if (statSync(taskFile).isFile()) {
        taskFiles.push(taskFile);
      }
    } catch {
      // ignore missing task.md
    }
  }

  if (taskFiles.length === 0) {
    throw new Error(`no task metadata files found in: ${tasksDir} (expected */task.md)`);
  }

  const tasks = new Map<string, Task>();

  for (const path of taskFiles) {
    const frontmatter = parseFrontmatter(path);

    const taskId = readFrontmatterString({ frontmatter, key: "id", path, required: true });
    if (tasks.has(taskId)) {
      throw new Error(`duplicate task id: ${taskId}`);
    }

    const status = readFrontmatterString({ frontmatter, key: "status", path, required: true }).toLowerCase();
    if (!ALLOWED_STATUS.has(status)) {
      throw new Error(
        `${path}: invalid status for ${taskId}: ${status} ` +
          `(allowed: ${Array.from(ALLOWED_STATUS).sort().join(", ")})`,
      );
    }

    const summary = readFrontmatterString({ frontmatter, key: "summary", path });
    const deps = normalizeDeps(frontmatter.deps, path, taskId);

    tasks.set(taskId, { taskId, deps, status, summary });
  }

  const unknownDeps: string[] = [];
  for (const task of tasks.values()) {
    for (const dep of task.deps) {
      if (!tasks.has(dep)) {
        unknownDeps.push(`${task.taskId} depends on unknown task ${dep}`);
      }
    }
  }
  if (unknownDeps.length > 0) {
    throw new Error(`invalid dependencies:\n${unknownDeps.join("\n")}`);
  }

  return tasks;
}

function buildActiveGraph(tasks: Map<string, Task>): {
  outgoing: Map<string, string[]>;
  incomingCount: Map<string, number>;
  activeIds: string[];
} {
  const activeIds = Array.from(tasks.values())
    .filter((task) => task.status !== "done")
    .map((task) => task.taskId)
    .sort((a, b) => a.localeCompare(b));

  const activeSet = new Set(activeIds);
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const taskId of activeIds) {
    incomingCount.set(taskId, 0);
  }

  for (const taskId of activeIds) {
    const task = tasks.get(taskId)!;
    for (const dep of task.deps) {
      if (!activeSet.has(dep)) {
        continue;
      }
      const targets = outgoing.get(dep) ?? [];
      targets.push(taskId);
      outgoing.set(dep, targets);
      incomingCount.set(taskId, (incomingCount.get(taskId) ?? 0) + 1);
    }
  }

  for (const [key, targets] of outgoing.entries()) {
    outgoing.set(
      key,
      [...targets].sort((a, b) => a.localeCompare(b)),
    );
  }

  return { outgoing, incomingCount, activeIds };
}

function topoBatches(params: {
  outgoing: Map<string, string[]>;
  incomingCount: Map<string, number>;
  activeIds: string[];
}): { batches: string[][]; remaining: string[] } {
  const { outgoing, incomingCount, activeIds } = params;
  if (activeIds.length === 0) {
    return { batches: [], remaining: [] };
  }

  const queue = activeIds.filter((id) => (incomingCount.get(id) ?? 0) === 0);
  const processed = new Set<string>();
  const batches: string[][] = [];

  while (queue.length > 0) {
    queue.sort((a, b) => a.localeCompare(b));
    const currentBatch = [...queue];
    queue.length = 0;
    batches.push(currentBatch);

    for (const taskId of currentBatch) {
      processed.add(taskId);
      for (const next of outgoing.get(taskId) ?? []) {
        incomingCount.set(next, (incomingCount.get(next) ?? 0) - 1);
      }
    }

    for (const taskId of activeIds) {
      if (processed.has(taskId)) {
        continue;
      }
      if ((incomingCount.get(taskId) ?? 0) === 0 && !queue.includes(taskId)) {
        queue.push(taskId);
      }
    }
  }

  if (processed.size !== activeIds.length) {
    const remaining = activeIds.filter((id) => !processed.has(id));
    return { batches, remaining };
  }

  return { batches, remaining: [] };
}

function findReadyNow(tasks: Map<string, Task>): string[] {
  const taskIds = Array.from(tasks.keys()).sort((a, b) => a.localeCompare(b));
  const ready: string[] = [];
  for (const taskId of taskIds) {
    const task = tasks.get(taskId)!;
    if (task.status !== "todo") {
      continue;
    }
    const allDepsDone = task.deps.every((dep) => tasks.get(dep)?.status === "done");
    if (allDepsDone) {
      ready.push(taskId);
    }
  }
  return ready;
}

function renderDagMarkdown(
  tasks: Map<string, Task>,
  batches: string[][],
  activeIds: string[],
): string {
  const totalCount = tasks.size;
  const doneCount = Array.from(tasks.values()).filter((task) => task.status === "done").length;
  const activeSet = new Set(activeIds);

  const lines: string[] = [];
  lines.push("# Dependency DAG", "", "## Snapshot", "");
  lines.push(`- Total: ${totalCount}`);
  lines.push(`- Done: ${doneCount}`);
  lines.push(`- Active: ${activeIds.length}`);
  lines.push("", "## Mermaid (Active Tasks Only)", "", "```mermaid", "graph TD");

  if (activeIds.length === 0) {
    lines.push("  DONE[All tasks are done]");
  } else {
    for (const taskId of activeIds) {
      const task = tasks.get(taskId)!;
      const activeDeps = task.deps.filter((dep) => activeSet.has(dep));
      if (activeDeps.length === 0) {
        lines.push(`  ${taskId}`);
        continue;
      }
      for (const dep of activeDeps) {
        lines.push(`  ${dep} --> ${taskId}`);
      }
    }
  }

  lines.push("```", "", "## Parallel Batches (Active Tasks)", "");
  if (batches.length === 0) {
    lines.push("- none");
  } else {
    batches.forEach((batch, idx) => {
      lines.push(`- B${idx + 1}: ${batch.join(", ")}`);
    });
  }

  lines.push("", "## Integration Order (Active Tasks)", "");
  if (batches.length === 0) {
    lines.push("none");
  } else {
    lines.push(batches.flat().join(", "));
  }

  lines.push("");
  return lines.join("\n");
}

function renderReadyMarkdown(tasks: Map<string, Task>, readyNow: string[]): string {
  const lines: string[] = [];
  lines.push("# Ready Now Tasks", "", "status=todo and all dependencies are done", "");
  lines.push("| Task ID | Summary | Depends On |", "|---|---|---|");

  if (readyNow.length === 0) {
    lines.push("| - | none | - |");
  } else {
    for (const taskId of readyNow) {
      const task = tasks.get(taskId)!;
      const dependsOn = task.deps.length > 0 ? task.deps.join(", ") : "-";
      const summary = task.summary || "-";
      lines.push(`| ${taskId} | ${summary} | ${dependsOn} |`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

const command = defineCommand({
  meta: {
    name: "integration_order",
    description:
      "Generate dependency-dag.md and ready-now.md from tasks/<task-id>/task.md frontmatter.",
  },
  args: {
    "tasks-dir": {
      type: "string",
      required: true,
      description: "Directory containing task directories (<task-id>/task.md)",
    },
    write: {
      type: "string",
      description: "Output path for dependency DAG markdown",
    },
    "ready-write": {
      type: "string",
      description:
        "Output path for ready-now markdown (default: sibling ready-now.md when --write is set)",
    },
  },
  run: ({ args }) => {
    if (args._.length > 0) {
      fail(`[error] Unknown positional arguments: ${args._.join(", ")}`);
    }

    const tasksDir = readStringOption(args["tasks-dir"], "--tasks-dir", true);
    const write = readStringOption(args.write, "--write");
    const readyWrite = readStringOption(args["ready-write"], "--ready-write");

    let tasks: Map<string, Task>;
    let batches: string[][];
    let activeIds: string[];

    try {
      tasks = loadTasks(tasksDir);
      const { outgoing, incomingCount, activeIds: active } = buildActiveGraph(tasks);
      const topo = topoBatches({ outgoing, incomingCount, activeIds: active });
      if (topo.remaining.length > 0) {
        fail(`[error] dependency cycle detected among: ${topo.remaining.join(", ")}`);
      }
      batches = topo.batches;
      activeIds = active;
    } catch (error) {
      fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
    }

    const readyNow = findReadyNow(tasks);
    const dagMarkdown = renderDagMarkdown(tasks, batches, activeIds);
    const readyMarkdown = renderReadyMarkdown(tasks, readyNow);

    if (write) {
      writeText(write, dagMarkdown);
      consola.success(`[ok] wrote ${write}`);
    } else {
      process.stdout.write(dagMarkdown);
    }

    const readyOutput = readyWrite || (write ? join(dirname(write), "ready-now.md") : "");
    if (readyOutput) {
      writeText(readyOutput, readyMarkdown);
      consola.success(`[ok] wrote ${readyOutput}`);
    } else {
      process.stdout.write(readyMarkdown);
    }
  },
});

void runMain(command).catch((error) => {
  fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
});

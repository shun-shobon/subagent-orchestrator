#!/usr/bin/env -S bun --install=fallback

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { defineCommand, runMain } from "citty";
import { consola } from "consola";

const ALLOWED_STATUS = new Set(["todo", "in_progress", "review", "done", "blocked"]);

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
  return value.trim();
}

function parseFrontmatter(path: string): Record<string, unknown> {
  const text = readFileSync(path, "utf-8");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error(`${path}: frontmatter must start with '---'`);
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === "---") {
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

function parseDeps(raw: string): string[] {
  const value = raw.trim();
  if (value.length === 0 || value === "-") {
    return [];
  }
  const unique = new Set<string>();
  const deps: string[] = [];
  for (const item of value.split(",")) {
    const dep = item.trim();
    if (dep.length === 0 || unique.has(dep)) {
      continue;
    }
    unique.add(dep);
    deps.push(dep);
  }
  return deps;
}

function loadExistingTaskIds(tasksDir: string): Set<string> {
  let dirExists = false;
  try {
    dirExists = statSync(tasksDir).isDirectory();
  } catch {
    return new Set();
  }

  if (!dirExists) {
    fail(`[error] --tasks-dir must be a directory path: ${tasksDir}`);
  }

  const taskIds = new Set<string>();
  const entries = readdirSync(tasksDir).sort((a, b) => a.localeCompare(b));
  for (const entry of entries) {
    const taskDir = join(tasksDir, entry);
    let isDir = false;
    try {
      isDir = statSync(taskDir).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) {
      continue;
    }

    const taskFile = join(taskDir, "task.md");
    if (!existsSync(taskFile)) {
      continue;
    }

    const frontmatter = parseFrontmatter(taskFile);
    const taskId = readFrontmatterString({
      frontmatter,
      key: "id",
      path: taskFile,
      required: true,
    });
    if (taskIds.has(taskId)) {
      throw new Error(`duplicate task id found in existing tasks: ${taskId}`);
    }
    taskIds.add(taskId);
  }

  return taskIds;
}

function renderTaskMarkdown(params: {
  taskId: string;
  summary: string;
  status: string;
  deps: string[];
  branch: string;
}): string {
  const { taskId, summary, status, deps, branch } = params;
  const yaml = Bun.YAML.stringify(
    {
      id: taskId,
      summary,
      status,
      deps,
      branch,
    },
    null,
    2,
  ).trimEnd();

  return `---
${yaml}
---

# ${taskId} ${summary}

## Goal

## Scope

## Non-scope

## Acceptance Criteria

## Coordinator Notes
`;
}

function renderTaskExecutionOutputMarkdown(): string {
  return `# Task Execution Output

## Execution Report

## PR Description Draft

## Remaining Issues
`;
}

function renderReviewMarkdown(): string {
  return `# Task Review

## Verdict

- status: pending
- reviewer:
- reviewed_at_utc:

## Findings

- severity:
  file:
  detail:

## Required Actions

- action:
  owner:
  due:
`;
}

const command = defineCommand({
  meta: {
    name: "create_task",
    description: "Create one task directory and template files under tasks.",
  },
  args: {
    "tasks-dir": {
      type: "string",
      required: true,
      description: "Directory containing task directories",
    },
    id: {
      type: "string",
      required: true,
      description: "Task ID (e.g. T02)",
    },
    summary: {
      type: "string",
      required: true,
      description: "Task summary",
    },
    branch: {
      type: "string",
      required: true,
      description: "Work branch name",
    },
    deps: {
      type: "string",
      description: "Comma-separated dependency task IDs",
    },
    status: {
      type: "string",
      default: "todo",
      description: "Task status",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing task files",
    },
  },
  run: ({ args }) => {
    if (args._.length > 0) {
      fail(`[error] Unknown positional arguments: ${args._.join(", ")}`);
    }

    const tasksDir = readStringOption(args["tasks-dir"], "--tasks-dir", true);
    const taskId = readStringOption(args.id, "--id", true);
    const summary = readStringOption(args.summary, "--summary", true);
    const branch = readStringOption(args.branch, "--branch", true);
    const deps = parseDeps(readStringOption(args.deps, "--deps"));
    const status = readStringOption(args.status, "--status", true).toLowerCase();
    const force = Boolean(args.force);

    if (!ALLOWED_STATUS.has(status)) {
      fail(
        `[error] invalid --status: ${status} ` +
          `(allowed: ${Array.from(ALLOWED_STATUS).sort().join(", ")})`,
      );
    }
    if (deps.includes(taskId)) {
      fail(`[error] task ${taskId} cannot depend on itself`);
    }

    let existingTaskIds: Set<string>;
    try {
      existingTaskIds = loadExistingTaskIds(tasksDir);
    } catch (error) {
      fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
    }

    if (existingTaskIds.has(taskId) && !force) {
      fail(`[error] duplicate task id: ${taskId}`);
    }

    const unknownDeps = deps.filter((dep) => !existingTaskIds.has(dep));
    if (unknownDeps.length > 0) {
      fail(`[error] unknown dependencies: ${unknownDeps.join(", ")}`);
    }

    const taskDir = join(tasksDir, taskId);
    const taskFile = join(taskDir, "task.md");
    const taskExecutionOutputFile = join(taskDir, "task-execution-output.md");
    const reviewFile = join(taskDir, "review.md");

    if (!force) {
      const existingFiles = [taskFile, taskExecutionOutputFile, reviewFile].filter((path) =>
        existsSync(path),
      );
      if (existingFiles.length > 0) {
        fail(
          `[error] output files already exist: ${existingFiles.join(", ")} ` +
            `(use --force to overwrite)`,
        );
      }
    }

    try {
      mkdirSync(taskDir, { recursive: true });
      writeFileSync(
        taskFile,
        renderTaskMarkdown({ taskId, summary, status, deps, branch }),
        "utf-8",
      );
      writeFileSync(taskExecutionOutputFile, renderTaskExecutionOutputMarkdown(), "utf-8");
      writeFileSync(reviewFile, renderReviewMarkdown(), "utf-8");
    } catch (error) {
      fail(
        `[error] failed to create task files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    consola.success(`[ok] created ${taskId} in ${taskDir}`);
  },
});

void runMain(command).catch((error) => {
  fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
});

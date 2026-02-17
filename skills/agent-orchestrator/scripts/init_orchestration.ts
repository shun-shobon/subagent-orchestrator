#!/usr/bin/env -S bun --install=fallback

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { defineCommand, runMain } from "citty";
import { consola } from "consola";

function fail(message: string): never {
  consola.error(message);
  process.exit(1);
}

function writeIfNeeded(filePath: string, content: string, force: boolean): void {
  if (existsSync(filePath) && !force) {
    consola.info(`[skip] ${filePath} already exists`);
    return;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  consola.success(`[ok] wrote ${filePath}`);
}

function validateRepoRoot(root: string): void {
  let rootStat;
  try {
    rootStat = statSync(root);
  } catch {
    fail(`[error] repo-root does not exist: ${root}`);
  }

  if (!rootStat.isDirectory()) {
    fail(`[error] repo-root must be an existing directory: ${root}`);
  }

  const gitEntry = join(root, ".git");
  if (!existsSync(gitEntry)) {
    fail(`[error] repo-root must contain .git: ${root}`);
  }
}

const command = defineCommand({
  meta: {
    name: "init_orchestration",
    description: "Initialize orchestration template files in an existing git repository.",
  },
  args: {
    repoRoot: {
      type: "positional",
      default: ".",
      description: "Existing git repository root path",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files",
    },
  },
  run: ({ args }) => {
    if (args._.length > 1) {
      fail(`[error] Unexpected positional arguments: ${args._.slice(1).join(", ")}`);
    }
    const root = String(args.repoRoot ?? ".").trim() || ".";
    const force = Boolean(args.force);

    validateRepoRoot(root);
    const orchDir = join(root, "orchestration");
    const tasksDir = join(orchDir, "tasks");
    try {
      mkdirSync(orchDir, { recursive: true });
      mkdirSync(tasksDir, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`[error] failed to create orchestration directory: ${message}`);
    }

    try {
      writeIfNeeded(
        join(orchDir, "README.md"),
        `# Orchestration Files

- \`charter.md\`: 目的、成功条件、制約、意思決定履歴。更新者はプロジェクト管理エージェント。
- \`tasks/<task-id>/task.md\`: タスク定義。タスク情報のSoT。更新者はプロジェクト管理エージェント。
- \`tasks/<task-id>/task-execution-output.md\`: 実施レポート、PR説明文、残課題。更新者はタスク実行エージェント。
- \`tasks/<task-id>/review.md\`: レビュー指摘、判定、対応状況。主にレビュー担当が記録。
- \`task-index.md\`: Ready Tasks と All Tasks の一覧。\`integration_order.ts\` で生成。
- \`integration-log.md\`: 統合記録、競合対応、検証結果。主に統合担当が記録。
- \`handover.md\`: 完了範囲、残課題、次アクション。主にプロジェクト管理エージェントが記録。
`,
        force,
      );

      writeIfNeeded(
        join(orchDir, "charter.md"),
        `# Project Charter

## Objective

## Success Criteria

## Constraints

## Out of Scope

## Open Questions

## Decision Log
`,
        force,
      );

      writeIfNeeded(
        join(orchDir, "task-index.md"),
        `# Task Index

## Ready Tasks

status=todo and all dependencies are done

| Task ID | Summary | Depends On |
|---|---|---|

## All Tasks

| Task ID | Summary | Status | Depends On | Branch |
|---|---|---|---|---|
`,
        force,
      );

      writeIfNeeded(
        join(orchDir, "integration-log.md"),
        `# Integration Log

| Timestamp (UTC) | Task ID | Branch | Result | Validation | Notes |
|---|---|---|---|---|---|
`,
        force,
      );

      writeIfNeeded(
        join(orchDir, "handover.md"),
        `# Handover

## Delivered Scope

## Remaining Risks

## Open Items

## Suggested Next Actions
`,
        force,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`[error] failed to initialize orchestration files: ${message}`);
    }

    consola.success(`[ok] orchestration templates are ready in ${orchDir}`);
  },
});

void runMain(command).catch((error) => {
  fail(`[error] ${error instanceof Error ? error.message : String(error)}`);
});

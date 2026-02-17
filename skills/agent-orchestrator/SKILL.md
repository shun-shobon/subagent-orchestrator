---
name: agent-orchestrator
description: プロジェクト管理エージェントと複数タスク実行エージェントでのオーケストレーション。明示的に指定した場合のみ呼び出すこと。
---

# Agent Orchestrator

## 目的

曖昧な構想から大規模な実装開発完了までを、複数のエージェントによる並列実行で進める。
判断・進捗・引継ぎ情報を `orchestration/` 配下に一元化する。
タスク情報は `orchestration/tasks/<task-id>/task.md` で管理する。
プロジェクト管理エージェントとタスク実行エージェントの役割を明確に分離する。

## 役割判定と参照先

- 次を1つでも満たす場合、タスク実行エージェントとして扱う。
  - プロンプトに「あなたはタスク実行エージェントです」が含まれる。
  - `TASK_ID` が明示され、単一タスクの実装またはレビューを指示される。
  - `task_id` / `worktree_path` などのタスク実行エージェント入力が渡される。
- 上記に該当しない場合、プロジェクト管理エージェントとして扱う。
- 判定後、次の playbook を必ず読む。
  - プロジェクト管理エージェント: `references/project-management-agent-playbook.md`
  - タスク実行エージェント: `references/task-execution-agent-playbook.md`
- 役割が曖昧な場合、作業開始前にどちらとして実行するか確認する。

## 管理ファイル

- `orchestration/README.md`: orchestration配下ファイルの役割と更新責務。
- `orchestration/charter.md`: 目的、成功条件、制約、意思決定履歴。
- `orchestration/tasks/`: タスク一覧。
- `orchestration/tasks/<task-id>/task.md`: プロジェクト管理エージェント管理のタスク定義（frontmatter、要件、受け入れ条件、調整メモ）。
- `orchestration/tasks/<task-id>/task-execution-output.md`: タスク実行エージェント成果（実施レポート、PR説明文ドラフト、残課題）。
- `orchestration/tasks/<task-id>/review.md`: レビュー指摘、判定、対応状況。
- `orchestration/task-index.md`: `integration_order.ts` が生成するタスク一覧と着手可能タスク。
- `orchestration/integration-log.md`: 統合記録、競合対応、検証結果。
- `orchestration/handover.md`: 最終引継ぎ情報。

## 追加参照の読み分け

- プロジェクト管理エージェントの運用と実行手順が必要な場合: `references/project-management-agent-playbook.md`
- タスク実行エージェントの実行手順が必要な場合: `references/task-execution-agent-playbook.md`
- タスク分解基準が必要な場合: `references/task-decomposition.md`
- 依存関係設計と並列化ルールが必要な場合: `references/dependency-model.md`
- worktree運用手順が必要な場合: `references/worktree-playbook.md`
- タスク実行エージェント契約が必要な場合: `references/task-execution-agent-contract.md`
- 役割分離の責務整理が必要な場合: `references/role-separation.md`
- 統合と競合解消方針が必要な場合: `references/merge-integration.md`
- ドキュメント更新規律が必要な場合: `references/doc-operations.md`

---
name: subagent-orchestrator
description: 複数サブエージェントでのオーケストレーション。明示的に指定した場合のみ呼び出すこと。
---

# Subagent Orchestrator

## 目的

曖昧な構想から実装完了までを、再現可能なオーケストレーション手順で進める。
判断・進捗・引継ぎ情報を `orchestration/` 配下に一元化する。

## 役割判定と参照先

- 次を1つでも満たす場合、サブエージェントとして扱う。
  - プロンプトに「あなたはサブエージェントです」が含まれる。
  - `TASK_ID` が明示され、単一タスクの実装またはレビューを指示される。
  - `task_id` / `worktree_path` などのサブエージェント入力が渡される。
- 上記に該当しない場合、メインエージェントとして扱う。
- 判定後、次の playbook を必ず読む。
  - メインエージェント: `references/main-agent-playbook.md`
  - サブエージェント: `references/subagent-playbook.md`
- 役割が曖昧な場合、作業開始前にどちらとして実行するか確認する。

## 管理ファイル

- `orchestration/README.md`: orchestration配下ファイルの役割と更新責務。
- `orchestration/charter.md`: 目的、成功条件、制約、意思決定履歴。
- `orchestration/task-breakdown.md`: タスク一覧、依存、DoD、状態。
- `orchestration/tasks/<task-id>/task.md`: メインエージェント管理のタスク定義（frontmatter、要件、受け入れ条件、調整メモ）。
- `orchestration/tasks/<task-id>/subagent-output.md`: サブエージェント成果（実施レポート、PR説明文ドラフト、残課題）。
- `orchestration/tasks/<task-id>/review.md`: レビュー指摘、判定、対応状況。
- `orchestration/ready-now.md`: 今すぐ着手可能な `todo` タスク一覧。
- `orchestration/integration-log.md`: 統合記録、競合対応、検証結果。
- `orchestration/handover.md`: 最終引継ぎ情報。

## 追加参照の読み分け

- メインエージェントの運用と実行手順が必要な場合: `references/main-agent-playbook.md`
- サブエージェントの実行手順が必要な場合: `references/subagent-playbook.md`
- タスク分解基準が必要な場合: `references/task-decomposition.md`
- 依存関係設計と並列化ルールが必要な場合: `references/dependency-model.md`
- worktree運用手順が必要な場合: `references/worktree-playbook.md`
- サブエージェント契約が必要な場合: `references/subagent-contract.md`
- 役割分離の責務整理が必要な場合: `references/role-separation.md`
- 統合と競合解消方針が必要な場合: `references/merge-integration.md`
- ドキュメント更新規律が必要な場合: `references/doc-operations.md`

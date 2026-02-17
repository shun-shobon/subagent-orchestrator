# ドキュメント運用ガイド

## 目的

どのエージェントでも即時に作業再開できる状態を、リポジトリ内文書で維持する。

## 更新タイミング

- スコープや制約が変わった時に `orchestration/charter.md` を更新する。
- タスク情報の source of truth は `orchestration/tasks/` 配下の各 `task.md` とする。
- 新規タスクは `bun run scripts/create_task.ts --tasks-dir orchestration/tasks --id <task-id> --summary "<summary>" --branch <branch> [--deps <dep1,dep2>] [--status <status>]` で作成する。
- タスク、担当、依存が変わった時に対象 `orchestration/tasks/<task-id>/task.md` を更新する。
- 実装中に問題が生じた場合、`orchestration/tasks/<task-id>/task.md` を再計画する。タスク追加、実装順変更、不要タスク削除を許容する。
- タスクの要件・受け入れ条件・調整事項が変わった時に `orchestration/tasks/<task-id>/task.md` を更新する。
- 再計画の判断理由と変更内容を対象 `orchestration/tasks/<task-id>/task.md` の `Coordinator Notes` に記録する。
- `orchestration/tasks/<task-id>/task.md` の frontmatter を変更した後に `bun run scripts/integration_order.ts --tasks-dir orchestration/tasks --index-write orchestration/task-index.md` を再実行し、`orchestration/task-index.md` を更新する。
- タスク実行エージェントの実施内容・PR説明・残課題が変わった時に `orchestration/tasks/<task-id>/task-execution-output.md` を更新する。
- タスク実行エージェント待機開始時刻を `orchestration/tasks/<task-id>/task.md` の `Coordinator Notes` に記録する。
- 1時間超過で介入または強制終了した場合、判断理由と結果を `orchestration/tasks/<task-id>/task.md` の `Coordinator Notes` に記録する。
- レビューごとに `orchestration/tasks/<task-id>/review.md` を更新する。
- 統合作業ごとに `orchestration/integration-log.md` を更新する。
- 完了時または担当移管時に `orchestration/handover.md` を更新する。

## 最小記録フォーマット

- UTCタイムスタンプ
- 実行者（agent id または名前）
- 実施内容
- 結果
- 次アクション

## 整合性ルール

- すべての文書で同一のタスクIDを使う。
- すべてのログで同一のブランチ/worktree命名を使う。
- ブロッカー記録には必ず担当者と次アクションを含める。

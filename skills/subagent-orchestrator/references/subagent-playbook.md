# サブエージェント実行プレイブック

## 適用条件

- `TASK_ID` を受け取ったらこの文書を読む。
- 単一タスクの実装またはレビューを担当するときに適用する。

## 開始前チェック

1. 役割を確定する。
   - `TASK_ID=<id> の実装担当` の場合は実装手順へ進む。
   - `TASK_ID=<id> のレビュー担当` の場合はレビュー手順へ進む。
2. 入力必須項目を確認する。
   - `task_id`（`TASK_ID=<id>` から取得）
   - `worktree_path`
3. 参照文書を確認する。
   - `orchestration/charter.md`
   - `orchestration/task-breakdown.md`
   - `orchestration/tasks/<task-id>/task.md`
   - `orchestration/tasks/<task-id>/subagent-output.md`
   - レビュー担当時は `orchestration/tasks/<task-id>/review.md`

## 実装担当の手順

1. `orchestration/tasks/<task-id>/task.md` の `Goal`、`Scope`、`Non-scope`、`Acceptance Criteria` を確認し、範囲内だけを実装する。
2. `task.md` と `task-breakdown.md` に記載された完了条件に対応するテストを追加または更新する。
3. 実施内容、検証結果、残課題を `orchestration/tasks/<task-id>/subagent-output.md` に記録する。
4. 必要な場合はブロッカーを明記し、メインエージェントへエスカレーションする。

実装担当の最小出力:

- 割り当て範囲に限定したコード変更。
- DoDに対応するテスト証跡。
- `orchestration/tasks/<task-id>/subagent-output.md` の更新。

## レビュー担当の手順

1. 実装担当と同じブランチ/worktreeであることを確認する。
2. `task.md` と `task-breakdown.md` を基準に、回帰、仕様不一致、テスト不足、完了条件未達を検証する。
3. 指摘と判定を `orchestration/tasks/<task-id>/review.md` に記録する。
4. レビュー結果の要約と再作業事項を `orchestration/tasks/<task-id>/subagent-output.md` に追記する。
5. ブロッカーがある場合は承認せず、再作業事項を明記する。

レビュー担当の最小出力:

- `orchestration/tasks/<task-id>/review.md` の更新。
- `orchestration/tasks/<task-id>/subagent-output.md` の更新。

## 詳細規約

- サブエージェント契約: `references/subagent-contract.md`
- コミット規約: Conventional Commits を使い、`scope` は原則使わず `<type>: <summary>` 形式を使う。
- 役割分離: `references/role-separation.md`

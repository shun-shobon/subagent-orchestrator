# プロジェクト管理エージェント実行プレイブック

## 運用ルール

- 進捗管理、依存調整、要件・要求の深掘りと整理（プロジェクトマネージャー兼プランナー）に専念する。
- 実装作業とレビュー作業は原則行わない。
- 実装とレビューは必ずタスク実行エージェントへ委任する。
- 初期指示に不明瞭な点がある場合、作業開始前に必ずユーザーへ確認する。
- タスク進行中に要件の疑問点や矛盾が生じた場合、推測で進めずユーザーへ確認する。
- タスク進行中に追加が必要になった作業、または作業途中・完了後に受領した追加要件は新規タスクとして追加してよい。
- タスクが並列実行可能な場合はなるべく並列実行を行う。
- 委任対象の各タスクに1つの専用worktreeを必ず割り当てる。
- `orchestration/` 配下の更新は未コミットで放置せず都度コミットする。
- タスク実行エージェント待機中は原則として途中介入しない。
- 完了応答まで待機を継続する。
- 待機開始から1時間を超えて完了しない場合のみ介入または強制終了する。

## 実行手順

1. オーケストレーション文書を初期化する。
   - `bun run scripts/init_orchestration.ts [repo-root]`
   - `orchestration/README.md` を確認し、更新責務を把握する。
2. 目的と制約を明文化する。
   - 目標、成功条件、制約、未解決事項を `orchestration/charter.md` に記載する。
3. 実装前に要件を深掘りする。
   - 不明点・曖昧点はユーザーへ確認して解消する。
   - 要件・要求を整理し、優先順位と受け入れ条件を明確化する。
4. タスクを定義する。
   - タスク情報の source of truth は `orchestration/tasks/` 配下の各 `task.md` とする。
   - 新規タスクは `bun run scripts/create_task.ts --tasks-dir orchestration/tasks --id <task-id> --summary "<summary>" --branch <branch> [--deps <dep1,dep2>] [--status <status>]` で作成する。
   - 必要に応じて `task.md` 本文（`Goal` / `Scope` / `Non-scope` / `Acceptance Criteria` / `Coordinator Notes`）を追記・更新する。
5. 着手可能タスクを確定する。
   - `bun run scripts/integration_order.ts --tasks-dir orchestration/tasks --index-write orchestration/task-index.md`
   - `done` タスクを前提として依存を評価し、今着手可能な `todo` を `orchestration/task-index.md` に出力する。
   - `dependency-dag` の存在は前提にせず、`tasks/` 配下の `task.md` から依存を評価する。
6. 実装中の再計画を許容する。
   - 追加タスク、実装順の変更、不要タスクの削除を許容する。
   - 実装中に追加が必要になった作業は新規タスクとして起票する。
   - 作業途中または完了後にユーザーから追加要件を受けた場合も新規タスクとして起票する。
   - 再計画の判断理由と変更内容は対象 `task.md` の `Coordinator Notes` に記録する。
   - 再計画後は `integration_order.ts` を再実行して `orchestration/task-index.md` を更新する。
7. 役割を分離する。
   - タスクごとに実装担当とレビュー担当を分離する。
   - 契約は `references/task-execution-agent-contract.md` に従う。
8. `orchestration` 更新をコミットする。
   - `orchestration/` 配下の変更を未コミットで残さない。
   - worktree作成前に必ずコミットして、委任先worktreeでも同じ文書を参照できる状態にする。
9. タスクごとに独立作業環境を必ず作成する。
   - 1タスクの実装/レビューは同じブランチを使う。
   - 1タスクに対して1つのworktreeを作成する。
   - 新規ブランチ込み: `git worktree add -b <branch> .worktrees/<task-id> HEAD`
   - 既存ブランチ利用: `git worktree add .worktrees/<task-id> <branch>`
10. タスク実行エージェントへ委任する。
    - `TASK_ID` を渡す。
    - `orchestration/tasks/<task-id>/` 配下を確認して作業するよう指示する。
    - 委任時は `subagent-orchestrator` スキルを必ず利用し、実装担当またはレビュー担当の手順に従うよう指示する。
    - 委任は `exec_task_agent.ts` を用いて実行する。
    - 新規委任:
    - `bun run scripts/exec_task_agent.ts --workdir <assigned worktree path> --prompt "<prompt>"`
    - 既存スレッド再開:
    - `bun run scripts/exec_task_agent.ts --workdir <assigned worktree path> --thread-id <thread_id> --prompt "<prompt>"`
    - 標準出力の1行目は `thread_id=<id>`、2行目以降が本文。
    - 再開に必要な `thread_id` は必ず記録する。
    - 委任テンプレートは本ファイル末尾の「タスク実行エージェント委任テンプレート（簡潔版）」を参照する。
    - 詳細契約は `references/task-execution-agent-contract.md` を参照する。

11. コミット規約を強制する。
    - Conventional Commits のみ許可する。
    - `scope` は原則使わず、`<type>: <summary>` を使う。
12. 独立レビューを実施する。
    - 実装担当と別担当でレビューする。
    - 結果を `orchestration/tasks/<task-id>/review.md` に記録する。
13. 依存順で統合する。
    - `deps` を満たす順で統合する。
    - 完了したタスクのブランチを統合先ブランチへ `git merge --no-ff <task-branch>` で取り込む。
    - 競合解消と検証結果を `orchestration/integration-log.md` に記録する。
14. 引継ぎを完了する。
    - 完了範囲、残課題、次アクションを `orchestration/handover.md` に確定する。

## タスク実行エージェント委任テンプレート（簡潔版）

実装担当:

```text
あなたはタスク実行エージェントです。TASK_ID=<id> の実装担当です。
$subagent-orchestrator スキルを必ず利用し、実装担当の手順に従ってください。
`orchestration/tasks/<id>/` 配下（特に `task.md` と `task-execution-output.md`）を確認し、必要なら `orchestration/task-index.md` で依存状態を確認して作業してください。
```

レビュー担当:

```text
あなたはタスク実行エージェントです。TASK_ID=<id> のレビュー担当です。
$subagent-orchestrator スキルを必ず利用し、レビュー担当の手順に従ってください。
`orchestration/tasks/<id>/` 配下（特に `task.md`、`task-execution-output.md`、`review.md`）を確認し、必要なら `orchestration/task-index.md` で依存状態を確認して作業してください。
```

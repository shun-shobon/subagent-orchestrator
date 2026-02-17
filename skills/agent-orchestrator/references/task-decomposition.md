# タスク分解ガイド

## 目的

1人の実装担当と1人のレビュー担当が、曖昧さなく実行できる粒度でタスクを定義する。

## ルール

- 技術レイヤーではなく、観測可能な成果で分解する。
- 1タスクにつき1つの検証可能な挙動変更に限定する。
- すべてのタスクにDoDを定義する。
- タスクごとに成果物の出力先パスを明示する。
- 1回のレビューで完了できるサイズに保つ。
- 不確実性が高い作業は先に調査タスクへ分離する。
- 実装中に問題が生じた場合、タスク追加、実装順変更、不要タスク削除で再計画する。

## タスクファイル構成

`orchestration/tasks/<task-id>/` を使う。
初期雛形は `bun run scripts/create_task.ts --tasks-dir orchestration/tasks --id <task-id> --summary "<summary>" --branch <branch> [--deps <dep1,dep2>] [--status <status>]` で作成する。

### Frontmatter必須項目

`task.md` の frontmatter に記載する。

- `id`: `T01` のような安定ID。
- `summary`: 振る舞い中心の短い要約。
- `status`: `todo` / `in_progress` / `review` / `done` / `blocked`。
- `deps`: 依存する `task_id` の配列。なければ `[]`。
- `branch`: 実装担当とレビュー担当が共有するブランチ。

### 本文推奨セクション

`task.md`:

- `Goal`
- `Scope`
- `Non-scope`
- `Acceptance Criteria`
- `Coordinator Notes`

`task-execution-output.md`:

- `Execution Report`
- `PR Description Draft`
- `Remaining Issues`

## アンチパターン

- 「バックエンドを作る」のような大きすぎるタスク名。
- 1タスクに複数実装担当を同時割当。
- 実装とレビューを同一担当にする。
- テスト証跡やレビュー証跡なしで `done` にする。

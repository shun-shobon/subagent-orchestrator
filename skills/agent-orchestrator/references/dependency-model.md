# 依存関係モデル

## 目的

タスク依存を整理し、並列実行バッチを明確化する。

## 入力形式

`orchestration/tasks/<task-id>/task.md` の frontmatter を使う。
`orchestration/tasks/` を依存情報の source of truth とする。

```markdown
---
id: T01
summary: 要件確定
status: done
deps: []
branch: docs/define-requirements
---
```

```markdown
---
id: T02
summary: API仕様追加
status: todo
deps: [T01]
branch: feat/add-api-spec
---
```

- `id`: タスクID。
- `deps`: 依存タスクIDの配列。依存なしは `[]`。
- `status`: `todo`, `in_progress`, `review`, `done`, `blocked`。
- `summary`: タスク要約。
- `branch`: タスクで使うブランチ（実装/レビュー共通）。

## 並列化ルール

- 同一バッチのタスクは、依存がすべて前バッチで満たされていること。
- 相互依存がないタスクは並列実行する。
- 同一ホットファイルを編集するタスクは、必要性が低ければ並列化しない。
- `done` タスクは依存グラフの対象から除外し、依存は「既に満たされた前提」として扱う。

## Task Index 判定

- `status=todo` であること。
- 依存先のタスクがすべて `done` であること。
- 結果は `orchestration/task-index.md` に出力する。

## 優先順位ヒューリスティクス

- 後続タスクの解除数が多いものを優先する。
- 不確実性の高いタスクを早めに実行して後工程リスクを減らす。

## 検証チェック

- `deps` の全IDが `id` として存在する。
- 循環依存がない。
- `done` 以外のタスクがいずれかのバッチに含まれる。

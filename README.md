# agent-orchestrator

`agent-orchestrator` は、Codex CLI 向けのエージェントオーケストレーションスキルです。

大規模なタスクを分割し、複数のエージェントによる並列実行で進めることを目的にしています。

## 使い方

1. このリポジトリの `skills/subagent-orchestrator` を、次のいずれかに配置します。
   - `~/.codex/skills/subagent-orchestrator`
   - `<プロジェクトルート>/.agents/skills/subagent-orchestrator`
2. Codex CLI で、スキルを指定して依頼します。
   ```text
   $subagent-orchestrator を使って、こんなものを作りたい。
   ```

これだけで、タスク分解と並列実行を前提にした進行に入れます。

## このスキルが向いているケース

- 実装範囲が広く、作業を分割したい
- 複数タスクを並列に進めたい
- 進捗・判断・引き継ぎを構造化して管理したい

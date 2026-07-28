# Token 使用记录

本文件只记录 Codex 内置 goal tracker 返回的真实值，不用字符数、文件数或人工公式推算。

| Checkpoint | 累计 Token | 记录状态 |
| --- | ---: | --- |
| 计划完成 | — | 当时未取得内置 tracker 取样 |
| Harness 完成 | — | 当时未取得内置 tracker 取样 |
| 链数据完成 | — | 当时未取得内置 tracker 取样 |
| UI / 钱包完成 | — | 当时未取得内置 tracker 取样 |
| 最终交付审计前 | 250,092 | 2026-07-28 读取；tracker 返回旧 `blocked` 状态且未继续递增 |
| 功能分支最终门禁 | 250,092 | 2026-07-28 读取；tracker 仍未继续递增 |
| 最终验证完成 | 250,092 | 2026-07-28 完成 deterministic gate、E2E、live probe 后读取；tracker 仍未继续递增 |

## Tracker 状态说明

最终交付取样前，内置 tracker 的 objective 仍是本项目 MVP，但状态曾停留在旧的 `blocked`，
并且后续开发期间 `tokensUsed` 没有变化。远程 `master` 推送完成后，目标已正式标记为
`complete`，最终读数仍为 `250,092`。该数值是真实的最终 tracker 读数，但不能反推出未取样
阶段的精确用量。

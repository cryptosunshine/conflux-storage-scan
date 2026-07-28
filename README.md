# Conflux Storage Scan

Conflux Storage Scan 是 Conflux eSpace 测试网的只读存储浏览器。它从
`FixedPriceFlow` 的 `Submit` 事件建立浏览器本地索引，用于查看存储概览、提交列表、
单条提交、提交者地址活动，以及连接钱包后的账户筛选结果。

项目是 Vite + React 单页应用。公开页面不依赖钱包，也没有服务端业务缓存；链上事件会经过
严格的代理合约校验和标准化，再写入当前浏览器的 IndexedDB。存储趋势图只聚合这份
canonical 本地索引，不会为绘图增加 RPC 请求。

## 产品范围

当前路由：

- `/`：合约提交数、已索引提交数、逻辑数据量、已分配存储和固定费用；
- `/submissions?page=1`：按 sequence 倒序分页的提交列表；
- `/submission/:sequence`：标准化事件和链上来源详情；
- `/address/:address?page=1`：按 `Submit.sender` 聚合的地址活动；
- `/history?page=1`：使用当前钱包地址筛选同一份公开索引；
- `/analytics?metric=storage&range=all`：存储增长和每日提交趋势详情。

`/analytics` 支持以下 URL 状态：

- `metric=storage|submissions`：决定进入页面时聚焦并强调的图表；
- `range=7d|30d|all`：选择最近 7 天、30 天或完整历史，缺失日期按 UTC 自然日补零。

首页趋势卡始终展示完整历史。图表的逻辑数据量、已分配存储量和提交数量均来自已经验证并
写入 IndexedDB 的 `Submit` 记录；图表查询不增加 JSON-RPC 方法、不重新执行
`eth_getLogs`，也不引入服务端索引器或共享缓存。

明确不包含：

- 挖矿、奖励或节点收益信息；
- 文件上传、下载或内容恢复；
- 签名、授权、合约写入或交易发送；
- 根据 `pricePerSector`、交易 gas 或其他字段推算费用；
- Dark Theme。

测试网产品费用恒定显示为 `0 CFX`，前端不会调用 `pricePerSector`。钱包仅用于取得
`/history` 的筛选地址，其他页面在未连接钱包时完整可用。

## 环境要求

- Node.js `>= 22.12.0`
- pnpm `11.17.0`（由 `packageManager` 固定）
- Chromium（仅运行 Playwright 端到端测试时需要）

建议通过 Corepack 使用仓库固定的 pnpm：

```bash
corepack enable
corepack pnpm install
```

## 本地运行

复制环境变量示例并按需修改：

```bash
cp .env.example .env.local
corepack pnpm dev
```

浏览器默认使用 Conflux 公共 eSpace 测试网 RPC。可配置项：

```dotenv
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com
VITE_WALLETCONNECT_PROJECT_ID=
```

- `VITE_CONFLUX_ESPACE_RPC_URL`：可替换为 Confura 或其他 chain ID 71 的兼容 JSON-RPC；
- `VITE_WALLETCONNECT_PROJECT_ID`：可选。为空时保留 EIP-6963/injected 钱包发现，不创建
  WalletConnect connector。

所有 `VITE_*` 变量会进入浏览器构建产物，不能用于存放真正的服务端秘密。使用带项目凭据的
RPC 时，应在提供方限制允许来源和配额。

## 合约身份

| 项目 | 值 |
| --- | --- |
| Chain ID | `71` |
| FixedPriceFlow BeaconProxy | `0x3fF03285AA79027Ecc552432336FCB85eaD7199e` |
| EIP-1967 Beacon | `0x7322ba93f0B6061C6FCE1af4ac5264cB252A0166` |
| 已验证 Implementation | `0xAd85554aa3446F7199644F852eC7bBa706af3eF9` |
| Market | `0xB43eE2d86c4Ccb1e958a77a4c52937Cc22255Ac1` |
| Deployment block | `253160870` |

应用在同步日志前校验 chain、proxy bytecode、EIP-1967 beacon、implementation bytecode 和
market。任何身份变化都会停止新日志解码；不能仅替换地址继续运行，必须重新核对开源合约、
窄 ABI、fixture 和回归测试。

## 数据与本地缓存

事件的 canonical identity 是
`(chainId, contractAddress, blockHash, transactionHash, logIndex)`。内存中的链上整数使用
`bigint`，JSON fixture 和 IndexedDB 持久化使用十进制字符串。

IndexedDB 命名空间包含 chain、proxy、implementation、schema 和 normalizer 版本；缺失的
日志时间戳会按 block hash 去重读取并跨同步持久化。
同步保留 128 个区块的重组回看窗口，按 canonical block hash 原子对账。RPC 暂时失败时保留
缓存数据并显示最后成功时间；本地索引不可读时，用户可确认后仅重建当前浏览器命名空间，
不会更改链上数据。

## Harness 与 fixtures

确定性测试读取：

```text
tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1
```

已接受的 fixture 版本不可覆盖。显式 capture 会探测 live RPC、校验部署身份、完整 sequence、
canonical key 和提交数量，把内容写入临时目录并校验 checksum，最后原子发布为下一个
`vN`。capture 不会自动执行 Git commit 或 push。

只读 live probe：

```bash
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com \
  corepack pnpm harness:probe
```

显式捕获新 fixture：

```bash
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com \
  corepack pnpm harness:capture
```

不要在自动测试中运行 capture，也不要把授权 header 或秘密凭据写入 fixture。

## 本地验证

```bash
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

`verify` 依次执行 Biome、TypeScript、Vitest 和生产构建。Playwright 在 Vite `test` 模式下
动态加载已接受 fixture，并断言不会请求 live RPC；生产构建会移除该测试数据源分支。

本 MVP 按约定不配置 GitHub Actions 或其他 CI，以上本地命令是交付质量门禁。

## 项目约束与设计文档

- [项目 Agent 约束](./AGENTS.md)
- [中文版产品与设计规范](./docs/superpowers/specs/2026-07-27-conflux-storage-scan-design.zh-CN.md)
- [存储趋势图设计规范](./docs/superpowers/specs/2026-07-28-storage-analytics-charts-design.zh-CN.md)
- [MVP 实施计划](./docs/superpowers/plans/2026-07-28-conflux-storage-scan-mvp.md)
- [存储趋势图实施计划](./docs/superpowers/plans/2026-07-28-storage-analytics-charts.md)
- [Token 使用记录](./docs/token-usage.md)

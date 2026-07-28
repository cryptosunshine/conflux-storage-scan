# Conflux Storage Scan——产品、数据、UI 与工程化 Harness 设计

状态：待最终评审

日期：2026-07-27

目标网络：Conflux eSpace 测试网，链 ID `71`

主合约：FixedPriceFlow 代理合约 `0x3fF03285AA79027Ecc552432336FCB85eaD7199e`

英文基线：[2026-07-27-conflux-storage-scan-design.md](./2026-07-27-conflux-storage-scan-design.md)

## 1. 项目目的

构建一个只读的 Conflux Storage Scan 前端。产品信息架构参考
[0G StorageScan——Galileo 测试网](https://storagescan-galileo.0g.ai/)，但产品数据仅来自
Conflux eSpace 测试网合约。

第一版采用纯客户端 React 应用。它需要证明：在不过早引入索引服务的前提下，仅使用
FixedPriceFlow 事件和只读方法，就能支撑一个实用的存储浏览器。

项目同时为中小型工程建立一套 Harness：

- 简洁的根目录 `AGENTS.md`；
- 仓库内、按领域划分的 Codex Skills；
- 带版本的 RPC 与合约 fixtures；
- 确定性测试和故障注入；
- 本地质量门禁；
- live probe 与自动 fixture 捕获命令。

第一版有意暂缓 CI 工作流和定时 live probe。

## 2. 已确认的产品决策

| 主题 | 决策 |
| --- | --- |
| 应用框架 | 实施时使用最新稳定版 Vite + React + TypeScript |
| 包管理器 | 实施时使用最新稳定版 pnpm，通过 `packageManager` 和 lockfile 固定版本 |
| 渲染模型 | 单页应用；MVP 不使用 Next.js、SSR 或应用后端 |
| 链访问 | Conflux eSpace 测试网 JSON-RPC / Confura 兼容端点 |
| 合约 | FixedPriceFlow 代理合约 `0x3fF03285AA79027Ecc552432336FCB85eaD7199e` |
| 产品范围 | 仅做存储提交浏览器 |
| 挖矿 | 不包含 |
| 奖励 | 不包含 |
| 上传/写操作 | 不包含 |
| 文件下载 | 不包含 |
| 存储费用 | 始终显示 `0 CFX`；不调用费用相关方法 |
| 钱包 | RainbowKit + wagmi + viem，支持 EIP-6963 多 Provider 发现 |
| 钱包要求 | 浏览公开页面不需要钱包；仅“我的提交”需要连接钱包 |
| 主题 | 仅 Light Theme |
| 路由 | 选择性参考 0G 中有价值且与挖矿无关的路由 |
| 缓存/错误体验 | 常规浏览器模式：缓存优先、后台刷新，并明确显示部分、陈旧和错误状态 |
| Fixtures | live 捕获自动创建新的不可变 fixture 版本 |
| Fixture 安全 | 不覆盖旧版本；不自动 commit 或 push |
| CI | MVP 不设置 GitHub Actions 或其他 CI 工作流 |

## 3. 事实来源

实施时必须区分“产品参考”和“技术事实”。

### 3.1 技术事实来源

1. Conflux eSpace 测试网上已部署的字节码和实时 RPC 响应。
2. 已部署 FixedPriceFlow BeaconProxy 当前指向的实现合约。
3. [0gfoundation/0g-storage-contracts](https://github.com/0gfoundation/0g-storage-contracts)，
   调研基于提交 `0dcef31fd6398c9aca7267dc5a7a9e1caf3a3581`。
4. 从已验证实现源码整理出的 ABI，并通过 checksum 固定。

如果源码、ABI 和已部署行为不一致，以已部署行为为准；继续编写产品代码前必须记录并解释差异。

### 3.2 产品与视觉参考

- [0G StorageScan](https://storagescan-galileo.0g.ai/) 仅作为信息架构和交互参考，
  不是数据模型的事实来源。
- [Conflux eSpace Testnet Scan](https://evmtestnet.confluxscan.org/) 和
  [Conflux-Chain/sirius-eth](https://github.com/Conflux-Chain/sirius-eth) 作为配色和辅助风格参考。
  调研的 `sirius-eth` 版本为 `745a1b90dd17523447ff4b0d39406761cf1de803`。
- [Conflux-Chain/conflux-hub](https://github.com/Conflux-Chain/conflux-hub) 作为工程规范参考，
  调研版本为 `39ce57f451a410d4df40a75405e58c265dcd6aaa`。本项目参考其中的 Vite、React、
  pnpm、TanStack、Tailwind、严格 TypeScript、路径别名和 Biome 规范，不照搬其产品专用依赖，
  也不采用其中放宽无障碍 lint 的例外。它不能覆盖本设计文档中的决策。
- 项目 UI Skill 是主要设计依据。不得照搬 ConfluxScan 的旧版页面结构。

## 4. 可行性调研结论

指定地址并不是独立的 FixedPriceFlow 实现，而是一个 BeaconProxy：

- FixedPriceFlow 代理：
  `0x3fF03285AA79027Ecc552432336FCB85eaD7199e`
- Beacon：
  `0x7322ba93f0b6061c6fce1af4ac5264cb252a0166`
- 2026-07-27 观测到的实现：
  `0xAd85554aa3446F7199644F852eC7bBa706af3eF9`
- Market：
  `0xB43eE2d86c4Ccb1e958a77a4c52937Cc22255Ac1`

调研快照返回：

- `paused() == false`；
- `submissionIndex() == 485`；
- `numSubmissions() == 485`；
- `tree().currentLength == 290624` 个扇区；
- `tree().unstagedHeight == 20`。

调研时的合约历史包含：

- 485 条 `Submit` 日志；
- 103 个不同的交易哈希；
- 单笔交易最多发出 20 条提交事件。

完整实时日志响应约为 0.69 MB。以当前数据量看，纯浏览器 MVP 可行，但必须使用分段请求、
持久化增量缓存，并且不能假设数据集会一直这么小。

以上数字只是观测值，不是常量。不得写入产品逻辑，也不得作为固定 UI 快照断言。

## 5. 合约语义

### 5.1 主数据集

`Submit` 事件是浏览器列表行的权威来源。只读方法用于补充全局状态和验证，不能取代事件历史。

关键语义：

- 事件中 indexed 的 `sender` 实际代表 `submission.submitter`。UI 必须标记为
  **提交者（Submitter）**，不能假设它等于外层交易的 `from`。
- `submission.data.length` 是提交数据的逻辑字节数。
- 事件顶层的 `length` 是存储扇区数量。
- 一个存储扇区为 256 字节。
- `tree.currentLength` 的单位同样是扇区。
- 合约支持 `batchSubmit`，因此一笔交易可以产生多条 `Submit` 日志。
- 由节点根构造的摘要更接近提交标识或数据根。UI 必须称为
  **提交标识（Submission Identity）** 或 **数据根（Data Root）**；除非后续源码验证明确证明，
  否则不能称为“文件哈希”。
- 出现 `Submit` 事件，只能证明该提交已在 eSpace 上被索引；不能证明任意文件内容当前仍可从
  存储节点取回。

### 5.2 序号语义

`submissionIndex` 是从零开始的业务序号：

- 当 `submissionIndex() == 485` 时，正常观测到的有效序号范围为 `0..484`；
- 它适合路由和展示；
- 它不是可以抵抗链重组的数据库主键。

权威记录键为：

```text
chainId + contractAddress + blockHash + transactionHash + logIndex
```

完成重组对账后，标准化模型还维护唯一的
`(chainId, contractAddress, sequence)` 查询索引。

### 5.3 费用语义

当前 Conflux 测试网版本没有存储费用，因此产品必须：

- 通过产品常量显示 `0 CFX`；
- 不调用 `pricePerSector`、费用估算、Market 定价或类似方法；
- 不从交易 gas 推断存储费用；
- 主详情页不显示交易 gas 费用或 gas 用量，避免把网络 gas 与存储定价混淆。

### 5.4 不支持的合约概念

该 FixedPriceFlow 部署不提供 0G 浏览器中的挖矿、奖励、矿工或下载概念。前端不得伪造这些数据。

MVP 不进行任何产品写调用。连接钱包不会触发签名、交易、授权额度或合约状态修改。

## 6. 路由与信息架构

支持的路由有意对应 0G StorageScan 中有价值的部分：

| 路由 | 用途 | 与 0G 的关系 |
| --- | --- | --- |
| `/` | 网络概览和最近提交 | 保留有价值的仪表盘和最近文件模式 |
| `/submissions` | 分页提交列表 | 对应 `/submissions`，移除下载功能 |
| `/submission/:sequence` | 提交详情 | 对应 `/submission/:sequence`，修正术语 |
| `/address/:address` | 某提交者对应的提交 | 对应 `/address/:address` |
| `/history` | 当前连接钱包的提交 | 对应 0G 的“My Files”，文案改为“我的提交” |
| `*` | 带搜索和返回操作的 404 状态 | 常规 SPA fallback |

明确不实现以下路由：

- `/tool`；
- `/files`；
- `/storage`；
- `/topMiners`；
- `/miners`；
- `/miner/:address`；
- `/rewards`；
- 任何下载路由；
- 内部交易详情路由。

交易哈希以新标签页跳转到对应的 Conflux eSpace 测试网交易页面，并使用安全的外链属性。

### 6.1 全局搜索

页头搜索支持：

- 十进制提交序号，跳转到 `/submission/:sequence`；
- 有效的 20 字节 EVM 地址，跳转到 `/address/:address`。

格式错误或不支持的输入需要在本地明确提示。不得把交易哈希静默当作地址；
输入未通过本地校验时不得发起 RPC 请求。

### 6.2 首页仪表盘

首页包含：

- 来自 `submissionIndex()` 的合约提交总数；
- 来自标准化日志的已索引提交数；
- `submission.data.length` 之和得到的已索引逻辑数据量；
- `tree.currentLength * 256` 得到的已分配存储量；
- 固定为 `0 CFX` 的存储费用；
- 同步健康状态；
- 5 条最近提交，以及前往 `/submissions` 的入口。

如果合约提交总数和已索引日志数不同，两个数值都必须展示，并通过“数据不完整”提示解释差异。
页面不得把不完整的本地索引伪装成完整数据。

### 6.3 提交列表

桌面端列：

1. 序号
2. 提交者
3. 交易哈希
4. 逻辑大小
5. 存储扇区数
6. 费用
7. 时间

不提供下载列。移动端保留序号、提交者、大小和时间，其余字段可通过行详情入口查看。

分页交互参考 0G，但数据来自本地标准化索引。页码写入 URL，确保刷新和浏览器前进/后退行为稳定。

### 6.4 提交详情

概览信息：

- 序号；
- 提交者；
- 提交标识/数据根；
- 状态：“已在 eSpace 索引”；
- 逻辑大小；
- 存储费用：`0 CFX`；
- 起始扇区；
- 结束扇区；如果合约采用不包含结束值的边界，必须明确标注；
- 扇区数量；
- 节点数量；
- 标签（存在时）。

链上信息：

- 区块高度；
- 区块哈希；
- 交易哈希及 ConfluxScan 外链；
- 交易内日志序号；
- 时间戳；
- 合约地址；
- 当前 ABI 快照对应的实现合约地址。

可以通过经过验证的 `getFlowRootByTxSeq` 只读调用补充此页面，但它不是列表所需数据，
也不能阻塞事件数据的展示。

### 6.5 地址详情

地址页展示：

- 带复制操作的 checksum 提交者地址；
- 该提交者的已索引提交总数；
- 该提交者对应的逻辑字节总量；
- 与 `/submissions` 相同形态的分页表格。

筛选依据是事件中的 `submission.submitter`，不是交易发送者。

### 6.6 我的提交

`/history` 是公开可访问但与账户状态有关的路由：

- 未连接：显示聚焦的钱包连接空状态；
- 已连接 Conflux eSpace 测试网：复用当前账户的地址查询；
- 已连接其他网络：数据仍由配置的公开 Conflux client 提供，同时提供切换网络操作，
  让钱包状态保持一致；
- 切换账户后立即使账户级查询失效并刷新。

公开浏览页面始终不要求连接钱包。

## 7. 应用架构

### 7.1 总体结构

```text
React 路由和 UI
        |
TanStack Query 编排
        |
StorageDataSource 接口
        |
+------------------------+-------------------------+
| LiveRpcDataSource      | FixtureDataSource       |
| viem public client     | 确定性测试数据          |
+------------------------+-------------------------+
        |
标准化器 + 链重组对账器
        |
IndexedDB 仓库
```

UI 只依赖 `StorageDataSource`，不能直接依赖 RPC 传输细节。这样将来可以用托管索引器替换
浏览器侧索引，而不需要重写页面。

### 7.2 选定的前端技术栈

- Vite；
- React；
- TypeScript 严格模式；
- TanStack Router；
- TanStack Query；
- viem；
- wagmi；
- RainbowKit；
- IndexedDB 及轻量类型封装；
- 使用 CSS 变量设计令牌的 Tailwind CSS；
- Vitest 和 Testing Library；
- Mock Service Worker 或等价的 fetch 层 RPC fixture adapter；
- Playwright，用于关键浏览器流程；
- Biome，用于格式化、lint 和 import 排序。

只有在依赖能明显降低项目复杂度时才加入。除非实施证据表明 URL 状态、React 状态、
TanStack Query 和 wagmi 状态不够用，否则不引入全局状态库。

### 7.3 建议的源码边界

```text
src/
  app/                 应用组合、providers、router
  features/
    dashboard/
    submissions/
    submission-detail/
    address/
    wallet-history/
    search/
  chain/
    abi/
    clients/
    contracts/
    normalize/
    sync/
  data/
    storage-data-source.ts
    live-rpc-data-source.ts
    fixture-data-source.ts
    indexed-db/
  wallet/
  components/
  styles/
  test/
```

Feature 可以导入 `chain`、`data`、`wallet` 和共享组件公开的类型和函数。
`chain` 与 `data` 模块不能导入页面组件。

### 7.4 与 Conflux 对齐的代码规范

在有助于保持一致性的范围内，项目采用当前 `conflux-hub` 的以下约定：

- 应用代码仅使用 ESM；
- 严格 TypeScript，拒绝未使用的局部变量、参数和不安全副作用；
- Tab 缩进，JavaScript/TypeScript 字符串使用双引号；
- 使用 Biome 整理 imports；
- 为稳定源码边界显式配置 Vite 和 TypeScript 路径别名；
- 通过 Vite 集成 Tailwind；
- 由 TanStack Router 管理路由；
- 使用 TanStack Query 管理异步服务端/RPC 状态。

自动生成的路由文件不参与格式化，也不能手工编辑。产品代码应优先使用小型命名函数和组件、
带类型的边界解析器，并为导出的 chain/data API 提供显式返回类型。

本项目不继承 `conflux-hub` 中关闭键盘或无障碍检查的例外。显式 `any`、未检查的非空断言，
以及只有点击事件的非交互元素，都必须给出范围明确的书面理由。

## 8. RPC 读取策略

### 8.1 运行时配置

RPC URL 属于运行时配置。凭据和带认证的 Confura URL 不得提交到仓库。
应用可以提供官方公开的 eSpace 测试网端点作为非敏感默认值，同时允许
`VITE_CONFLUX_ESPACE_RPC_URL` 覆盖。

公开 client 必须强制校验链 ID `71`。链 ID 不一致属于阻断性数据错误，不能仅做可忽略的警告。

### 8.2 首次同步

首次同步流程：

1. 校验链 ID、代理合约代码、Beacon、实现合约和 ABI 兼容性；
2. 如果存在，加载最后一个持久化 IndexedDB checkpoint；
3. 没有 checkpoint 时，从已验证的部署区块开始；
4. 以自适应区块范围请求 `Submit` 日志；
5. 解码并校验每条日志；
6. 日志不含时间戳时，获取并缓存区块时间戳；
7. 在同一个 IndexedDB 事务中写入标准化记录和下一个 checkpoint；
8. 对账最近的重叠区块窗口，然后才能把索引标记为最新。

请求成功后逐步扩大区块范围；遇到 Provider 限制、超时或响应过大时缩小范围。
失败分段使用带 jitter 的指数退避重试。单个分段失败不能导致整个历史同步从头开始。

### 8.3 增量刷新与链重组

每次刷新：

- 重新读取最近的重叠区块窗口，而不是只相信最后区块高度；
- 将 `blockHash` 作为记录标识的一部分；
- 当历史记录对应的日志消失或标记为 `removed` 时，删除孤块记录；
- 插入替代的权威链记录；
- 原子提交记录和 checkpoint；
- 使受影响的聚合查询和地址查询失效。

默认重组重叠窗口为 128 个区块。它是具名配置常量，不是环境秘密。
重组 fixtures 必须跨越 checkpoint 边界验证此行为。修改该值前，确定性重组测试套件必须通过。

### 8.4 时间戳兼容

当前观测到的 Confura 日志响应包含 `blockTimestamp` 和 `transactionLogIndex`。
由于标准 `eth_getLogs` 响应并不普遍保证 `blockTimestamp`：

- 有效的日志时间戳仅作为优化使用；
- 缺失时通过 `eth_getBlockByNumber` 获取；
- 以 `(chainId, blockHash)` 缓存时间戳；
- fixtures 同时覆盖增强版和标准日志结构。

### 8.5 读取预算

普通列表渲染不得为每一行分别请求 receipt 或区块。日志批量解码，区块时间戳请求去重；
只有打开详情路由时，才执行详情专用的可选读取。

不得调用任何与存储定价有关的 RPC 方法。

## 9. 标准化数据模型

可能超过 JavaScript 安全整数范围的数量，在内存中使用 `bigint`，在 fixtures 或持久化的
JSON 结构中使用十进制字符串。

```ts
interface StorageSubmission {
  chainId: 71
  contractAddress: Address
  implementationAddress: Address

  sequence: bigint
  submitter: Address
  submissionIdentity: Hex
  logicalSizeBytes: bigint
  startSector: bigint
  sectorCount: bigint
  endSectorExclusive: bigint
  nodeRoots: readonly Hex[]
  tags: Hex

  blockNumber: bigint
  blockHash: Hex
  transactionHash: Hex
  transactionIndex: number
  logIndex: number
  transactionLogIndex?: number
  timestamp: number
}
```

派生展示值不作为权威数据持久化：

- 已分配字节数 = `sectorCount * 256`；
- 费用 = `0 CFX`；
- 距今时间 = `now - timestamp`；
- 展示状态 = 已索引状态与同步状态的映射。

## 10. 缓存与面向用户的故障行为

### 10.1 缓存行为

IndexedDB 存储：

- 标准化提交；
- 序号和提交者索引；
- 区块时间戳；
- 同步 checkpoint；
- 标准化时使用的 proxy/beacon/implementation 标识；
- schema 和 normalizer 版本。

正常再次访问时，立即渲染缓存数据并在后台刷新。

如果 schema、ABI、实现合约标识或 normalizer 版本发生不兼容变化，应用必须开启新的缓存命名空间，
或执行明确的数据迁移。不得用新语义静默解释旧记录。

### 10.2 可见状态

每个数据页面都必须支持：

- 首次加载；
- 空数据；
- 最新数据；
- 刷新中；
- 陈旧缓存；
- 部分索引；
- 可恢复 RPC 错误；
- 合约/ABI 不兼容；
- 缓存损坏恢复。

临时 RPC 故障发生时，应保留有效缓存并显示最后一次同步成功时间。
合约/ABI 不兼容时必须停止解码新数据，并说明浏览器正在等待经过验证的更新。

### 10.3 恢复

用户可以重试 RPC 读取。缓存损坏时提供范围明确的“重建本地索引”操作；
用户确认后仅清理本应用带版本的 IndexedDB 数据库，不能清理整个浏览器存储。

## 11. BeaconProxy 安全

Harness 和运行时采用严格实现合约模式。

解码实时数据前，probe 必须验证：

- 预期链 ID；
- 配置的代理地址存在代码；
- EIP-1967 Beacon 引用；
- Beacon 地址存在代码；
- Beacon 当前实现合约；
- 实现合约与 manifest 记录的 ABI/源码快照一致。

如果 Beacon 实现发生变化：

1. 停止使用旧 ABI 解码新的实时数据；
2. 仅以明确的“陈旧数据”状态保留已经标准化的缓存；
3. 检查并验证新的实现源码；
4. 重新生成 ABI 和 checksum；
5. 捕获新的 fixture 版本；
6. 运行标准化、回归和浏览器测试；
7. 更新已接受的实现合约 manifest。

升级后，应用不得“继续用旧 ABI 试试看”。

## 12. 钱包集成

RainbowKit 负责钱包展示，wagmi 负责账户和 connector 状态，viem 负责链定义和 RPC 基础能力。

必须支持：

- 通过 EIP-6963 发现注入式钱包；
- wagmi 支持范围内的旧式 injected provider fallback；
- 分别展示多个已安装钱包；
- 连接和断开；
- 使用 wagmi 标准持久化进行静默重连；
- 账户切换；
- 链切换；
- Conflux eSpace 测试网切换/添加网络操作；
- 只有通过环境配置提供 project ID 时才启用 WalletConnect。

通过 wagmi 的多 injected provider 发现配置保持 EIP-6963 开启。
不得把所有注入钱包合并成含义模糊的“浏览器钱包”。

实时数据 client 与已连接钱包的 provider 相互独立。即使用户钱包连接在其他网络，
仍可通过配置的公开 client 浏览 Conflux 存储数据。

## 13. 视觉设计

### 13.1 方向

最终视觉应当像一个现代、聚焦的 Conflux 产品：

- 信息密度高但不压迫；
- 层级清晰；
- 页面留白和卡片间距充足；
- 表格现代且响应式良好；
- 不使用装饰性挖矿图形；
- 不照搬 0G 或 ConfluxScan 布局；
- 不提供 Dark Theme 或主题切换。

### 13.2 精确色彩令牌

Light Theme 使用以下来源色值，并按语义分配：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `--color-primary` | `#17B38A` | 主操作、健康状态、选中强调 |
| `--color-primary-soft` | `#AFE9D2` | 柔和的成功/选中背景 |
| `--color-primary-strong` | `#05343F` | 强品牌区域和高对比强调 |
| `--color-link` | `#1E3DE4` | 链接 |
| `--color-link-hover` | `#0F23BD` | 链接 hover/focus 强调 |
| `--color-interactive` | `#4665F0` | 次级交互强调 |
| `--color-accent-muted` | `#7789D3` | 图表和辅助强调 |
| `--color-warning` | `#F8963E` | 部分数据/陈旧警告 |
| `--color-surface` | `#FFFFFF` | 主表面 |
| `--color-surface-raised` | `#FDFDFE` | 卡片 |
| `--color-canvas` | `#F0F4F3` | 页面画布 |
| `--color-surface-subtle` | `#F1F3F9` | 弱化行和控件 |
| `--color-surface-blue` | `#F5F7FF` | 信息面板 |
| `--color-border` | `#EBECED` | 边框和分隔线 |
| `--color-text-strong` | `#0F1327` | 最强正文 |
| `--color-heading` | `#26244B` | 标题 |
| `--color-text` | `#424A71` | 正文 |
| `--color-text-muted` | `#65709A` | 可访问的次级文本 |

精确遵循配色不代表每一页必须使用每一种颜色。令牌使用必须保证文字对比度、
清晰可见的焦点状态和一致的语义。

### 13.3 核心组件

- 紧凑的 sticky 应用页头；
- 全局搜索；
- 网络标记；
- RainbowKit 钱包控件；
- 指标卡片；
- 同步健康状态；
- 响应式数据表格；
- 地址/哈希复制控件；
- 外链提示；
- 分页；
- 骨架屏；
- 空、陈旧、部分数据和阻断错误面板。

桌面和移动端共享同一个信息模型。移动端不能变成不同的产品，也不能隐藏关键详情入口。

## 14. 项目级 Codex Harness

### 14.1 根目录 `AGENTS.md`

第一版只使用一个简洁的根目录 `AGENTS.md`，包含：

- 产品不变量；
- 事实来源；
- 架构和依赖边界；
- 精确的 Skill 路由；
- Proxy/ABI 安全规则；
- fixture 规则；
- 必需的本地验证；
- 完成定义。

在真实子目录确实需要不同指令前，不引入嵌套 `AGENTS.md`。

### 14.2 仓库内 Skills

Skills 放在 `.agents/skills/` 下，由 Codex 自动发现。

#### `develop-conflux-storage-data`

用于：

- ABI 或合约语义；
- RPC 访问；
- 事件解码；
- Proxy/Beacon 校验；
- 标准化；
- IndexedDB 同步；
- fixtures 和链故障测试。

该 Skill 必须强制执行提交者、大小、扇区、序号语义，以及“不调用费用方法”规则。

#### `integrate-rainbowkit-wallets`

用于：

- RainbowKit；
- wagmi 配置；
- viem 链定义；
- EIP-6963 和注入式钱包；
- WalletConnect；
- 账户/网络状态；
- `/history`。

该 Skill 必须强制执行 MVP 只读行为，并保证不连接钱包也能浏览公开页面。

#### `design-conflux-storage-ui`

用于：

- 路由和页面组合；
- 组件；
- 响应式行为；
- 设计令牌；
- 加载/空/错误状态；
- 无障碍和视觉回归检查。

该 Skill 必须保证：仅 Light Theme、使用精确 Conflux 配色、视觉现代，
且不存在挖矿或下载 UI。

跨领域工作必须加载所有适用 Skills，例如：

- 提交详情数据与 UI：数据 Skill + UI Skill；
- 钱包历史页：钱包 Skill + 数据 Skill + UI Skill；
- 网络不匹配错误设计：钱包 Skill + UI Skill。

Skill 路由用于改善 Agent 上下文；确定性测试仍然是正确性保障。

## 15. RPC Fixtures 与自动 live 捕获

### 15.1 目录布局

```text
tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/
  v1/
    manifest.json
    captures/
    expected/
    synthetic/
    faults/
  v2/
    ...
```

每个版本被接受后都不可修改。

### 15.2 Manifest

Manifest 记录：

- 捕获时间；
- 链 ID；
- 不含敏感信息的 RPC 端点类型；
- Proxy、Beacon、Implementation 和 Market 地址；
- 合约源码仓库和 commit；
- ABI 文件 SHA-256；
- normalizer 版本；
- 部署/起始区块；
- 捕获时的 head 区块及其哈希；
- 请求的日志区间；
- 请求和响应 checksum；
- 预期记录数；
- 可选增强 RPC 字段的 feature flags。

认证请求头、带凭据的查询参数、钱包数据和无关 RPC 响应绝不能写入。

### 15.3 “自动写入”的定义

`pnpm harness:capture` 是显式的开发者命令。它先执行 live probe，然后自动写出一个完整的新
fixture 版本，不要求逐个文件交互。

命令流程：

1. 执行全部 Proxy 和 ABI 安全检查；
2. 捕获范围受控的实时 RPC 请求和响应；
3. 标准化捕获结果；
4. 校验内部不变量；
5. 选择下一个未使用的 `vN` 目录；
6. 写入同级临时目录；
7. 校验 checksum 和预期输出；
8. 将临时目录原子重命名为 `vN`。

该命令绝不能：

- 覆盖已有 fixture 版本；
- 原地修改已接受 fixture；
- commit；
- push；
- 存储秘密；
- 从浏览器应用运行时写 fixture。

如果 probe、标准化、checksum 或不变量校验任一步骤失败，都不能发布新版本。

由于 CI 和定时执行已暂缓，该命令在被调用时会自动完成写入，但第一版不通过定时器或 PR 自动运行。

### 15.4 确定性预期数据

保留原始请求和响应，以验证传输层一致性。单独的 expected 文件保存标准化结果，
所有大整数序列化为十进制字符串。

Synthetic fixtures 覆盖实时历史当前可能不存在的小型场景，包括空 tags、多个 nodes、
单交易多提交和边界大小数值。

## 16. 故障注入

Harness 必须在不访问 live RPC 的情况下复现：

- HTTP 429 / Provider 限流；
- 超时；
- 临时网络错误；
- 已裁剪或不可用的区块范围；
- 过大的日志区间响应；
- 不完整的 JSON-RPC batch 响应；
- 重复日志；
- 乱序日志；
- `removed: true` 日志；
- 同高度但区块哈希变化的链重组；
- 格式错误的事件数据；
- 缺失序号；
- 无效的增强 `blockTimestamp`；
- 缺失增强字段；
- 损坏的 IndexedDB 记录；
- 陈旧 checkpoint；
- Beacon 实现合约变化；
- 错误链 ID。

标准化数据层和用户可见状态层都要断言预期行为。

## 17. 测试与本地质量门禁

### 17.1 单元与合约测试

- ABI checksum 和预期事件/方法表面；
- 事件解码；
- 提交标识计算；
- 字节/扇区计算；
- 序号边界；
- 批量提交处理；
- 地址标准化；
- `bigint` 序列化；
- 分页和聚合计算；
- Proxy/Beacon 标识校验；
- 链重组对账；
- 自适应范围重试。

### 17.2 组件与集成测试

- 搜索路由和校验；
- 缓存优先渲染；
- 加载、空、最新、刷新中、陈旧、部分和错误状态；
- 不存在下载或挖矿 UI；
- 费用始终为 `0 CFX`；
- 外部交易链接；
- 未连接和已连接状态下的 `/history`；
- 网络不匹配和切换操作；
- 实现合约变化时的阻断状态。

### 17.3 浏览器测试

基于 fixtures 的关键浏览器流程：

1. 首页到提交列表；
2. 按序号搜索；
3. 按地址搜索；
4. 提交详情；
5. 地址页分页；
6. 未连接钱包时的历史页；
7. 模拟 EIP-6963 多钱包发现；
8. 陈旧缓存随后成功刷新；
9. RPC 故障时使用缓存 fallback；
10. 移动端导航和表格详情入口。

### 17.4 本地命令

实现至少提供：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
pnpm harness:probe
pnpm harness:capture
```

`pnpm verify` 执行确定性本地质量门禁，不访问 live RPC。
`pnpm harness:probe` 是只读 live 命令。
`pnpm harness:capture` 访问 live RPC，并写入一个新的不可变 fixture 版本。

MVP 不创建 `.github/workflows` 或同类 CI 配置。以后 CI 可以直接执行相同本地命令，
无需改变测试语义。

## 18. 安全、隐私与运行规则

- 产品 RPC 只读。
- 连接钱包不请求签名或交易。
- RPC 凭据仅通过环境配置提供。
- Fixtures 必须移除请求头和带凭据 URL 中的敏感信息。
- 地址和交易哈希属于公开链上数据；不建立分析画像。
- 外链使用 `noopener noreferrer`。
- RPC 和 IndexedDB 数据在渲染前必须校验。
- UI 不得把解码字节直接注入 HTML。
- 错误信息不得暴露环境秘密或原始认证数据。
- Provider 故障时，在可能的情况下退化为缓存/陈旧数据模式。

## 19. 验收标准

满足以下条件时，MVP 才算验收通过：

1. 应用以 Vite React SPA 形式在桌面端和移动端正常加载。
2. 未连接钱包时，公开页面正常工作。
3. live RPC 索引能够从已验证部署区间重建全部有效 `Submit` 记录，并从 IndexedDB 增量恢复。
4. 即使交易哈希重复，批量提交也会生成不同序号的记录行。
5. 首页总量明确区分合约计数和已索引计数。
6. `/submissions`、`/submission/:sequence`、`/address/:address` 和 `/history` 按设计工作。
7. 所有存储费用均显示 `0 CFX`，并且不调用费用 RPC 方法。
8. 不存在挖矿、奖励、上传或下载 UI。
9. 交易哈希链接到 Conflux eSpace 测试网浏览器。
10. EIP-6963 能正确展示多个注入式钱包。
11. 错误网络和未连接钱包状态清晰且可恢复。
12. Beacon 实现合约变化时阻止不安全的新解码。
13. 临时 RPC 故障期间缓存仍可使用，并明确标记为陈旧。
14. 基于 fixtures 的测试可以复现 Provider、链重组、错误数据和缓存故障。
15. `pnpm verify` 和基于 fixtures 的 Playwright 测试在本地通过。
16. `pnpm harness:capture` 原子创建带 checksum 的新 fixture 版本，
    不覆盖、不 commit、不 push。
17. Light Theme 使用指定的精确 Conflux 配色，并在对应语义下满足无障碍要求。
18. 仓库包含根目录 `AGENTS.md` 和三个项目 Skills，路由与约束符合本设计。

## 20. 明确不做的内容

- 挖矿、矿工排名、奖励、Epoch 或挖矿经济模型；
- 上传工具或合约写操作；
- 文件下载或存储节点读取；
- 存储可用性验证；
- 服务端渲染；
- 托管 API、数据库或共享索引器；
- 交易详情页；
- 费用发现或估算；
- Dark Theme；
- 数据分析；
- CI 工作流配置；
- live 捕获后自动 Git commit 或 push。

## 21. 后续演进

如果浏览器侧索引变得过慢，或 Provider 限制产生实质影响，托管索引器可以实现同一个
`StorageDataSource` 接口。前端路由和标准化领域模型应保持稳定。

以后可以通过现有本地命令增加 CI 和定时只读 live probe。任何自动更新 fixture 的 PR
都需要单独明确决策，因为它会改变仓库状态和评审流程。

## 22. 进入实施前的剩余门槛

当前不存在阻碍实施计划编写的未决产品问题。唯一剩余门槛是批准这份实际设计文档。

批准后：

1. 编写逐步实施计划；
2. 搭建 Vite React 项目和工程化 Harness；
3. 使用 fixture-first 测试实施合约/RPC 基础层；
4. 实施路由和钱包集成；
5. 应用设计系统和响应式状态；
6. 使用 fixtures 和只读 live probe 完成本地验证。

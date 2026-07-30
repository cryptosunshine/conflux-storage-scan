# Conflux Storage Node 直连 POC 设计

状态：待书面评审

日期：2026-07-30

目标分支：`codex/direct-storage-node-poc`

目标网络：Conflux eSpace 测试网，链 ID `71`

主合约：FixedPriceFlow 代理合约
`0x3fF03285AA79027Ecc552432336FCB85eaD7199e`

上游参考：
[0gfoundation/0g-storage-ts-sdk](https://github.com/0gfoundation/0g-storage-ts-sdk)

## 1. 目的

在 Indexer 尚未可用的情况下，验证浏览器能否直接与 Conflux Storage Node 完成一条可工作的
存储闭环：

1. 浏览器读取并切割文件；
2. 计算 Merkle Root、Segment Proof 和 FixedPriceFlow Submission；
3. 通过现有 RainbowKit、wagmi 和 viem 提交 `submit` 交易；
4. 等待 Storage Node 同步对应的链上 Submit 事件；
5. 将 Segment 直接上传到一个健康的 Storage Node；
6. 按 TxSeq 或 Data Root 从 Storage Node 下载文件；
7. 重新计算 Root，并在可能时逐字节校验内容。

这是一个仅限本地 HTTP 环境的协议 POC，不是生产可用的上传服务。

## 2. 与当前只读产品的关系

`master` 上的 Conflux Storage Scan 继续保持只读，不增加上传、下载、签名或合约写入行为。

本 POC 只存在于独立分支 `codex/direct-storage-node-poc`：

- 从 `master` 创建；
- 正常提供 `/storage` 产品路由，不使用隐藏的开发路由；
- 完成后推送远程功能分支；
- 不合并到 `master`；
- 不修改或污染 `master` 的只读发布物。

进入代码实施时，本分支需要同步更新根目录 `AGENTS.md` 和相关项目 Skills，明确写操作只允许
出现在 POC 的严格边界内。原有浏览器路由和 `StorageDataSource` 继续保持只读。

## 3. 已确认范围

| 主题 | 决策 |
| --- | --- |
| 环境 | 仅本地 HTTP |
| Indexer | 不使用 |
| 页面 | 单一 `/storage` 路由 |
| 导航 | 主导航显示“存储 / Storage” |
| 上传 | 支持单文件直连上传 |
| 下载 | 支持按 TxSeq 或 Data Root 下载 |
| 完整性 | 下载后重新计算 Merkle Root |
| 文件数量 | 每次一个文件 |
| 文件大小 | 大于 `0 B` 且不超过 `100 MiB` |
| 加密 | 第一版不支持 |
| Tags | 固定为 `0x` |
| 存储费 | 固定 `0 CFX`，交易 `value: 0n` |
| 网络 Gas | 由钱包正常支付，并与存储费明确区分 |
| 钱包 | 现有 RainbowKit、wagmi、viem |
| 节点 | 两个固定候选节点，选择一个健康节点上传 |
| 会话恢复 | 保存元数据，不保存文件内容 |
| 国际化 | 中文和英文 |
| Git | 推送功能分支，不合并 `master` |

## 4. Storage Node 实测事实

POC 固定以下候选节点：

```text
http://47.84.225.228:5678
http://47.84.224.253:5678
```

2026-07-30 的只读探测确认：

- 两个端点均提供 JSON-RPC；
- 两个端点均允许浏览器跨域 POST；
- 两个端点均报告 `chainId == 71`；
- 两个端点均报告正确的 FixedPriceFlow 地址；
- 两个端点的 Shard 配置均为 `{ shardId: 0, numShard: 1 }`；
- 两个端点都能按 TxSeq 读取已有文件 Segment；
- 两个端点均未提供可用 HTTPS。

探测时：

- `47.84.224.253` 的 `nextTxSeq` 与链上 `submissionIndex` 一致；
- `47.84.225.228` 落后于链头，并缺失最新的 TxSeq。

这些同步高度和 TxSeq 只是观测值，不能写成业务常量。节点地址、目标 chain ID 和目标合约地址
是 POC 常量。

## 5. 上游 SDK 采用边界

第一版采用上游 SDK 的浏览器文件计算能力：

- File/Blob 迭代；
- 256 字节 Chunk；
- 256 KiB Segment；
- Flow padding；
- Merkle Tree；
- Segment Proof；
- Submission metadata。

第一版不调用上游高层 `Indexer.upload()` 或 `Uploader.uploadFile()`，原因包括：

- 高层上传会读取 `market()` 和 `pricePerSector()`；
- `fee: 0n` 不能阻止费用读取；
- `skipTx` 在节点尚未同步时仍可能提交交易；
- 上游轮询没有适合浏览器 POC 的超时和取消边界；
- 直接传入多个节点可能等待或上传到所有节点；
- 当前项目的交易栈是 viem/wagmi，而不是 ethers。

本 POC 自行实现合约提交、节点 RPC、节点选择、上传状态机和下载验证。

端到端验证成功后，再决定是否把必要的文件计算代码按上游 ISC 许可证最小化移植到仓库。
第一版不复制整个上游 SDK，也不发布独立 npm SDK。

第一版固定使用 `@0gfoundation/0g-storage-ts-sdk@1.2.10`，不得使用 semver 范围。调研参考的
上游源码 commit 是 `2b4b07d5011eeed64f0f2c7a63639e3df6198932`。由于该 commit 的
`package.json` 仍显示 `1.2.9`，fixtures 还必须记录 npm tarball integrity；如果源码仓库和
已发布包不一致，以实际锁定的 npm 包内容作为 POC 计算事实，并把差异写入测试说明。

## 6. 总体架构

```text
/storage React 页面
        |
Storage POC Controller
        |
+------------------------+---------------------------+
| File Computation       | Wallet Contract Submit    |
| Merkle/Proof/Metadata  | wagmi + viem              |
+------------------------+---------------------------+
        |                              |
        +---------------+--------------+
                        |
                 Upload Session
                        |
                  Storage Node Pool
                        |
             Storage Node JSON-RPC Client
                        |
      +-----------------+-----------------+
      |                                   |
47.84.225.228:5678              47.84.224.253:5678
```

现有 `StorageDataSource` 不增加写方法。Storage POC 使用独立的接口和 Query/Mutation 边界，
防止上传行为渗透到只读 Explorer 数据层。

建议源码边界：

```text
src/
  features/
    storage-poc/
      storage-page.tsx
      storage-page.test.tsx
      upload-panel.tsx
      download-panel.tsx
      node-health-panel.tsx
  storage/
    config.ts
    types.ts
    file/
      browser-storage-file.ts
      submission.ts
    contract/
      submit-storage.ts
    node/
      storage-node-client.ts
      node-pool.ts
    upload/
      upload-session.ts
      upload-session-store.ts
    download/
      download-file.ts
```

具体文件可以在实施计划中按测试边界微调，但不能把合约提交、Node RPC 和 React 状态混在同一个文件。

## 7. 合约提交

上传使用已经连接的 RainbowKit/wagmi 账户：

- 交易发送者是当前连接账户；
- `submission.submitter` 同样是当前连接账户；
- 不允许自定义 submitter；
- 钱包必须连接 Conflux eSpace 测试网；
- 错误网络时提供标准切换网络操作；
- `submit` 的 `value` 固定为 `0n`；
- 不调用 `market`、`pricePerSector` 或其他价格发现方法。

提交前必须重新执行严格部署验证：

1. 钱包链 ID 为 `71`；
2. FixedPriceFlow 代理地址存在代码；
3. EIP-1967 Beacon 与接受的 manifest 一致；
4. Beacon Implementation 与接受的 manifest 一致；
5. 本地 ABI 与接受的实现相匹配。

任一检查失败时，停止交易并显示阻断错误。

交易确认后，从本次 receipt 的 FixedPriceFlow `Submit` 事件中解析 TxSeq。不能读取
`submissionIndex()` 后自行减一，也不能假设交易中只有一条无关事件。事件还必须与本次 Submission
的提交标识相匹配。

## 8. 节点池与健康选择

两个地址只在 `src/storage/config.ts` 中定义。页面和业务模块不得直接引用 IP。

每次开始上传或下载前，并行检查候选节点：

1. `zgs_getStatus` 能在超时内返回；
2. `networkIdentity.chainId == 71`；
3. `networkIdentity.flowAddress` 与固定代理地址大小写无关地相等；
4. `zgs_getShardConfig` 返回合法配置；
5. 候选集合能覆盖一个完整副本；
6. 节点同步高度与链头距离在允许范围内；
7. 对已有 TxSeq 的操作，节点已经同步该 TxSeq。

第一版只选择一个完整、健康、同步程度最高的节点。两个当前节点都是完整的 `0/1` 节点，
因此不需要跨节点拼接 Shard。

故障转移规则：

- 合约交易前可以自由重新选择健康节点；
- 合约交易后不得因为节点故障重新提交交易；
- 上传中只能切换到已同步相同 TxSeq 的完整节点；
- 切换后可以幂等地重新上传尚未确认的 Segment；
- 没有合格备用节点时，保留会话并让用户稍后重试。

## 9. 上传状态机

上传采用显式状态机：

```text
idle
  -> preparing
  -> ready
  -> awaiting-wallet
  -> transaction-pending
  -> waiting-node-sync
  -> uploading
  -> verifying-node
  -> downloading-for-verification
  -> completed
```

任何可恢复阶段可以进入 `paused` 或 `recoverable-error`。部署不兼容、错误链和 Root 不匹配进入
`blocked-error`。

### 9.1 文件准备

- 拒绝空文件；
- 拒绝大于 `100 MiB` 的文件；
- `tags` 固定为 `0x`；
- 计算 Root、Submission 和 Segment 数量；
- 准备完成前不请求钱包签名；
- 页面显示文件名、字节数、Root、Segment 数量和预计步骤；
- “存储费用”显示 `0 CFX`；
- 单独提示需要 eSpace 网络 Gas。

### 9.2 节点同步

交易 receipt 成功后：

- 每秒调用一次 `zgs_getFileInfoByTxSeq`；
- 最长等待 5 分钟；
- 返回 FileInfo 后校验 TxSeq、Root、文件大小等可验证字段；
- 超时不重新提交交易；
- 保存 TxHash、TxSeq 和 Root，并提供“重新检查节点”。

### 9.3 Segment 上传

- Segment 固定为 256 KiB；
- 每个 JSON-RPC 请求先上传一个 Segment；
- 并发数为 2；
- 使用 `zgs_uploadSegmentsByTxSeq`；
- 每个 Segment 携带 Root、Base64 data、局部索引、Merkle Proof 和文件大小；
- 最多重试 3 次；
- 重试使用递增退避；
- “已经上传”或等价幂等响应视为成功；
- 非重试错误立即停止该会话；
- 上传进度使用已确认 Segment 数量和字节数计算，不使用模糊文本推断。

上传完成后重新读取 FileInfo，校验 `uploadedSegNum` 和节点可用状态。节点最终性可以单独展示，
但不允许无限等待。

## 10. 下载与完整性验证

下载支持两种定位方式：

- TxSeq；
- Data Root。

下载前选出已经同步目标记录的健康完整节点。按顺序调用 Storage Node Segment 下载 RPC，
在浏览器中重建 Blob。

第一版下载同样限制为 `100 MiB`。如果 FileInfo 声明的大小超过限制，在下载数据前拒绝操作。

下载完成后：

1. 对下载 Blob 重新计算 Merkle Root；
2. 与目标 Data Root 比较；
3. Root 不一致时，不创建成功状态；
4. 如果上传用的原始 File 仍在当前会话内，再执行逐字节比较；
5. 校验成功后才启用保存操作。

通用下载文件名为：

```text
storage-<txSeq>.bin
```

按 Root 下载且无法确定 TxSeq 时，使用 Root 的短格式构造文件名。

## 11. 会话持久化与恢复

IndexedDB 只保存：

- schema 版本；
- 上传阶段；
- connected account；
- 文件名和文件大小；
- Root；
- TxHash；
- TxSeq；
- 选定节点；
- 已确认 Segment 索引；
- 创建和更新时间；
- 最后一个可恢复错误。

IndexedDB 不保存原始文件、私钥、签名、授权信息或钱包 Provider。

刷新后：

- 已发送交易的会话仍然可见；
- 用户需要重新选择文件；
- 重新计算的 Root 和大小必须与保存值一致；
- 一致时可以从节点状态继续；
- 不一致时拒绝恢复；
- 恢复流程不得再次调用合约 `submit`。

## 12. 页面与交互

`/storage` 页面包含：

1. Local HTTP POC 警告；
2. 当前网络、钱包和 FixedPriceFlow 状态；
3. 两个候选节点的健康信息；
4. 上传文件区；
5. 结构化上传步骤和进度；
6. 当前或最近上传会话；
7. 按 TxSeq/Data Root 下载区；
8. 下载完整性结果。

页面遵循现有 Light Theme、Conflux 色彩令牌、响应式布局和中英文体系。

Local HTTP 警告必须明确说明：

- 当前节点不支持 HTTPS；
- Cloudflare/HTTPS 页面无法直连；
- 该能力只用于本地协议验证；
- POC 不代表生产级可用性、持久性或多副本保障。

下载和节点健康检查不要求钱包。只有提交交易时要求连接钱包。

## 13. 错误处理

必须区分：

- 无可用节点；
- 节点 CORS/网络错误；
- 节点身份错误；
- 节点落后；
- Shard 不完整；
- 钱包未连接；
- 钱包网络错误；
- 用户拒绝交易；
- 交易回滚；
- Beacon/Implementation 不兼容；
- 节点尚未同步 TxSeq；
- Segment 上传限流；
- Segment 上传不可恢复错误；
- FileInfo 与本地 Submission 不一致；
- 下载 Segment 缺失；
- 下载 Root 不匹配；
- 恢复时文件不匹配。

错误消息不得暴露钱包内部对象、RPC 认证信息或完整原始响应。可恢复错误保留会话和已确认进度。

## 14. 安全与隐私

- 原始文件名不进入链上 tags；
- `tags` 固定为 `0x`；
- 不持久化文件内容；
- 不读取或处理私钥；
- 只使用钱包标准交易请求；
- 合约写入仅允许固定 FixedPriceFlow `submit`；
- 合约 `value` 固定为 `0n`；
- 静态测试阻止 `pricePerSector` 和 Market 定价调用；
- Node Client 只允许固定 JSON-RPC 方法；
- 下载数据在保存前必须校验 Root；
- 页面明确说明数据和提交信息会公开进入测试网络。

网络 Gas 不是存储费。UI 和测试必须保证两者不会被混淆。

## 15. Harness 与测试

### 15.1 文件计算 fixtures

为以下边界建立确定性 fixtures：

```text
1 B
255 B
256 B
257 B
262143 B
262144 B
262145 B
```

每个 fixture 至少固定：

- 文件内容生成规则；
- Root；
- Submission nodes；
- Segment 数量；
- 首尾 Segment Proof；
- 上游 SDK 版本和源码 commit。

空文件必须返回明确错误。

### 15.2 Node RPC fixtures

覆盖：

- 两个健康完整节点；
- 一个健康、一个落后；
- 错误 chain ID；
- 错误 Flow 地址；
- 非法 Shard；
- 不完整 Shard 集合；
- 节点超时；
- 节点在等待期间追上；
- TxSeq 永远不可见；
- 部分 Segment 已上传；
- 上传限流；
- 已上传幂等响应；
- 下载 Segment 缺失；
- FileInfo 字段异常。

### 15.3 合约与会话测试

覆盖：

- 错误网络阻止提交；
- Beacon 或 Implementation 改变时阻止提交；
- `value` 始终为 `0n`；
- 从 receipt 的正确 Submit 事件解析 TxSeq；
- 用户拒绝交易；
- 交易回滚；
- 刷新恢复不重复提交交易；
- 重新选择错误文件时阻止恢复。

### 15.4 组件和浏览器测试

覆盖：

- Local HTTP 警告；
- 节点状态；
- 文件大小校验；
- 钱包连接和网络切换；
- 上传各阶段；
- 可恢复错误和重试；
- TxSeq/Root 下载；
- Root 校验成功和失败；
- 中英文；
- 移动端布局。

确定性测试不得调用真实 Storage Node 或发送真实交易。

### 15.5 Live 验证

自动 live probe 只允许调用只读方法：

- `zgs_getStatus`；
- `zgs_getShardConfig`；
- `zgs_getFileInfo`；
- `zgs_getFileInfoByTxSeq`；
- 受控范围的 Segment 下载。

真实上传必须由用户在本地浏览器中使用测试网钱包手动确认。仓库不能加入测试私钥，也不能在
普通测试、Harness 或脚本中自动发送真实交易。

## 16. 验收标准

满足以下条件时，POC 代码可以推送为完成状态：

1. `/storage` 在本地 HTTP 环境正常加载；
2. 两个固定节点都经过身份和 Shard 校验；
3. 落后节点不会阻塞健康节点；
4. 一个不超过 `100 MiB` 的非空文件能生成稳定 Root 和 Submission；
5. 合约提交使用 chain ID `71`、固定代理地址和 `value: 0n`；
6. 代码不调用 `market` 或 `pricePerSector`；
7. receipt 能解析得到正确 TxSeq；
8. 节点同步超时不会导致重复提交交易；
9. Segment 能幂等上传到健康节点；
10. 文件能按 TxSeq 或 Root 下载；
11. 下载 Root 验证通过后才允许保存；
12. 刷新后可以通过重新选择相同文件恢复会话；
13. 中文、英文和响应式状态完整；
14. 确定性测试不访问实时网络；
15. `corepack pnpm verify` 通过；
16. 适用的 `corepack pnpm test:e2e` 通过；
17. 真实上传仅由用户钱包手动验证；
18. 功能分支推送到 origin，但不合并 `master`。

## 17. 明确不做

- Indexer；
- HTTPS 代理；
- Cloudflare 生产支持；
- 多文件队列；
- 大于 `100 MiB` 的上传或下载；
- 文件加密；
- 链上文件名或 MIME 标签；
- 主动双节点复制；
- 后台 Service Worker 上传；
- 跨浏览器文件内容恢复；
- 自动真实交易测试；
- 独立 npm SDK；
- 合并到 `master`。

## 18. 后续演进

POC 验证成功后可以分别评审：

1. 为 Storage Node 配置 HTTPS 域名或增加同源代理；
2. 接入 Indexer 和可信节点选择；
3. 将文件计算与 Node Client 抽取成 Conflux Storage SDK；
4. 增加版本化 Tags、文件名和 MIME；
5. 增加断点上传、多文件队列和更大的流式下载；
6. 决定生产上传产品是否与只读 Storage Scan 合并。

这些演进不属于当前 POC，也不能因为本设计获得隐式授权。

# Conflux Storage Scan——存储趋势图设计

**日期：** 2026-07-28  
**状态：** 已批准  
**范围：** 首页紧凑趋势卡与 `/analytics` 详情页  
**明确不包含：** Cloudflare 服务端缓存、服务端索引器、挖矿、奖励、Gas、费用趋势、上传或下载

本设计是
`docs/superpowers/specs/2026-07-27-conflux-storage-scan-design.zh-CN.md`
的增量变更：只撤销其中“analytics”这一项非目标，并新增 `/analytics` 路由。其余产品不变量、
非目标、RPC 约束与视觉约束继续有效。实现时必须同步更新 `AGENTS.md`、仓库内 UI skill 和
Harness 静态验证规则，使文档、工程约束与路由保持一致。

## 1. 目标

在不新增 RPC 方法、不重复扫描链、不改变只读产品定位的前提下，把已经索引的
`FixedPriceFlow.Submit` 事件整理成可解释的时间序列。

本功能回答两个问题：

1. 已索引的逻辑数据量和已分配存储量如何随时间增长？
2. 每个 UTC 自然日新增了多少次提交？

首页提供快速趋势判断；详情页提供完整坐标、时间范围切换、精确 tooltip 和可访问的
文本/表格替代表达。

## 2. 已确认的产品决策

- 首页采用两张独立紧凑趋势卡，位于指标卡之后、最近提交表格之前。
- 桌面端两列，移动端单列。
- 第一张为 `Storage growth`，第二张为 `Submission activity`。
- 首页默认显示全部历史，不提供时间范围切换。
- 点击整张卡进入 `/analytics`，并通过 `metric` 查询参数定位对应图表。
- `/analytics` 不加入顶部主导航。
- 详情页同时保留两张完整图表，支持 `7D / 30D / All`。
- 时间范围写入 URL；默认 `range=all`。
- 所有日粒度统计使用 UTC。
- 无提交日期补零；累计曲线延续前值。
- 费用始终为产品常量 `0 CFX`，不绘制费用图表。
- 不展示挖矿、奖励、Gas、下载或文件可用性信息。

## 3. 数据架构

### 3.1 数据源边界

扩展 `StorageDataSource`，增加一次完整的时间序列查询。Dashboard 与 Analytics 页面只依赖
该接口，不直接调用 RPC，也不通过循环分页拼装完整数据集。

建议领域类型：

```ts
interface StorageTimelinePoint {
  readonly date: string
  readonly dailySubmissionCount: bigint
  readonly dailyLogicalBytes: bigint
  readonly cumulativeSubmissionCount: bigint
  readonly cumulativeLogicalBytes: bigint
  readonly allocatedSectorCount: bigint
  readonly allocatedBytes: bigint
}

interface StorageAnalyticsTimeline {
  readonly points: readonly StorageTimelinePoint[]
  readonly firstSubmissionDate?: string
  readonly asOfDate: string
}
```

`date` 与 `asOfDate` 都是规范化的 UTC `YYYY-MM-DD`。整数在领域层和缓存层继续使用
`bigint`；只有图表坐标适配器可以将缩放后的值转换成有限 `number`，tooltip 和可访问文本
仍使用原始 `bigint` 格式化。

### 3.2 聚合函数

使用一个无副作用的纯函数从完整、已标准化的 `StorageSubmission` 集合生成时间序列。
FixtureDataSource 与 live IndexedDB 数据源复用同一函数。

对每个 UTC 日期计算：

- `dailySubmissionCount`：当天 `Submit` 事件数量；
- `dailyLogicalBytes`：当天所有 `submission.data.length` 之和；
- `cumulativeSubmissionCount`：截至当天的累计提交数量；
- `cumulativeLogicalBytes`：截至当天的累计逻辑数据量；
- `allocatedSectorCount`：截至当天最大的 `endSectorExclusive`；
- `allocatedBytes`：`allocatedSectorCount * 256n`。

时间轴从第一条已索引提交的 UTC 日期开始，补齐到当前 UTC 日期。无提交日期的每日增量为
零，累计值沿用上一天。聚合必须与输入顺序无关，并用规范事件身份去重后的数据作为输入。

空数据集返回空 `points` 和当前 `asOfDate`，不能伪造零值历史。

### 3.3 查询与 RPC 行为

时间序列使用 TanStack Query 缓存，并在现有同步成功后与 summary/list 查询一同失效。
该查询只读取已经落入 Fixture 或 IndexedDB 的标准化记录：

- 不新增 JSON-RPC 方法；
- 不为图表重新执行 `eth_getLogs`；
- 不读取 `pricePerSector`；
- 不引入 Cloudflare Worker、定时任务或共享服务端缓存。

如果合约提交数与已索引数不一致，时间序列仍可显示，但必须继承 partial 状态，明确写成
“Indexed data”，不能暗示曲线代表完整合约历史。

## 4. 页面与交互

### 4.1 首页趋势卡

两张趋势卡放在五张指标卡之后、`Recent submissions` 之前。

`Storage growth`：

- 累计逻辑数据量使用 `#17B38A`；
- 已分配存储量使用 `#7789D3`；
- 两条折线共享时间轴和字节单位；
- 卡片头部显示最新已分配容量以及逻辑数据利用率；
- 点击进入 `/analytics?metric=storage&range=all`。

`Submission activity`：

- 使用 `#4665F0` 柱状图；
- 显示每日新增提交数量；
- 卡片头部显示累计已索引提交数；
- 点击进入 `/analytics?metric=submissions&range=all`。

首页卡片的图表是摘要，不显示完整坐标标签；保留少量网格/基线和最后值。整卡为可聚焦链接，
但图表内部不放嵌套交互控件。Hover、focus-visible 和 active 状态使用现有 Conflux Light
Theme token。

### 4.2 Analytics 详情页

新增 `/analytics` 路由，校验查询参数：

- `metric`: `storage | submissions`，非法值归一化为 `storage`；
- `range`: `7d | 30d | all`，非法值归一化为 `all`。

页面顶部包含标题、UTC/as-of 说明和 `7D / 30D / All` 分段控件。切换范围更新 URL，
支持刷新、分享、前进和后退。

两张完整图表都在页面中：

1. `Indexed storage growth`
   - 累计逻辑数据与累计已分配容量双折线；
   - tooltip 显示 UTC 日期、当日新增逻辑数据、累计逻辑数据、累计已分配容量和利用率。
2. `Daily submission activity`
   - 每日新增提交柱状图；
   - tooltip 显示 UTC 日期、当日新增提交和截至当日累计提交。

`metric` 决定初始焦点和视觉强调。路由加载后将对应图表标题置为焦点目标；如果用户启用了
`prefers-reduced-motion`，不执行平滑滚动或入场动画。

### 4.3 响应式与可访问性

- 1440px：首页两列趋势卡；详情图表使用完整宽度。
- 1024px：保持两列，但减少图表内边距和刻度数量。
- 390px：首页和详情均单列；tooltip 不得溢出视口。
- 图表容器具有明确高度，避免 `ResponsiveContainer` 布局抖动。
- Recharts 启用 accessibility layer，并关闭不尊重 reduced-motion 的动画。
- 每张图表使用 `<figure>`、可见标题和简短趋势摘要。
- 提供屏幕阅读器可访问的数据表，包含当前范围内每个 UTC 日期的核心值。
- 颜色不是唯一区分手段；图例、线型、标签和文本同时表达序列含义。

## 5. 数据状态与错误行为

### 5.1 Loading

首页显示两个固定高度的趋势卡骨架；详情页显示标题、范围控件骨架和两个图表骨架。骨架不得
造成页面主体布局跳动。

### 5.2 Empty

没有已索引提交时显示：

> No indexed submission history is available yet.

不绘制虚假的零曲线，并保留同步状态和重试入口。

### 5.3 Refreshing、Stale 与 Partial

- 后台刷新时保留旧图表，只显示非阻断 refreshing 状态。
- RPC 暂时失败但缓存有效时保留旧图表，显示最后同步时间。
- partial 时保留图表并显示警告，说明图表仅基于当前已索引事件。
- 重建本地索引后，Analytics 查询与现有 summary/list 查询一起失效并重算。

### 5.4 Corrupt 与 Incompatible

缓存损坏时不尝试在 UI 层跳过坏记录；沿用现有“重建本地索引”恢复入口。代理实现不兼容时
停止 live 解码，图表只显示经过验证的缓存数据并继承阻断状态。

## 6. 组件边界

建议新增：

- `src/analytics/build-storage-timeline.ts`：纯聚合与范围裁剪；
- `src/analytics/types.ts`：时间序列领域类型；
- `src/components/charts/storage-growth-chart.tsx`；
- `src/components/charts/submission-activity-chart.tsx`；
- `src/components/charts/chart-data-table.tsx`；
- `src/features/analytics/analytics-page.tsx`；
- `src/routes/analytics.tsx`。

Dashboard 只组合 `AnalyticsPreviewCards`，不包含聚合算法或 Recharts 配置细节。两种图表共享
统一 tooltip、日期格式、字节刻度和空状态辅助函数，但各自保留清晰的展示职责。

## 7. 依赖

使用当前最新稳定版 Recharts，并由 pnpm lockfile 固定实际安装版本。只导入需要的图表组件，
不引入第二套可视化库。

Recharts 只负责 SVG 图形、坐标、tooltip 和响应式布局；产品语义、格式化、可访问摘要、
错误状态和数据表由项目代码控制。

## 8. 测试策略

按 TDD 实施。

### 8.1 聚合单元测试

- 输入无序仍按 UTC 日期正确聚合；
- 跨 UTC 日期边界；
- 无活动日期补零；
- 累计逻辑字节；
- 最大 `endSectorExclusive` 而非每日扇区数求和；
- 输入为空；
- `7D / 30D / All` 的包含边界；
- 超过安全整数的数据仍保留 `bigint` 事实值。

### 8.2 数据源契约测试

同一组断言覆盖 FixtureDataSource 和 live source 的 mock RPC + fake IndexedDB：

- 返回一致时间序列；
- 图表查询不新增 RPC 请求；
- 同步/重建后查询得到新数据；
- partial 与 stale 状态不会丢失缓存图表。

### 8.3 组件与路由测试

- 首页出现两张趋势卡且位于最近提交之前；
- 卡片链接生成正确 `metric` 和 `range`；
- `/analytics` 参数归一化；
- 范围切换更新 URL；
- loading、empty、refreshing、stale、partial 状态；
- 图表标题、摘要、图例和数据表可通过语义角色访问；
- 页面不存在 mining、reward、gas、download 和非零 fee 文案。

### 8.4 浏览器验证

在 1440px、1024px 和 390px 验证：

- 首页双列/单列切换；
- 两张卡进入正确详情位置；
- 浏览器前进、后退和刷新保持范围；
- tooltip 不溢出；
- 键盘可操作；
- reduced-motion；
- 深层 `/analytics` 路由可直接访问。

最终运行：

```bash
corepack pnpm verify
corepack pnpm test:e2e
corepack pnpm harness:probe
```

确定性测试不得访问 live RPC；`harness:probe` 只做最终只读链上探测。

## 9. Git 交付

功能在 `codex/storage-analytics-charts` 分支完成。设计、计划、实现和测试均提交到该分支并推送
到 `origin`。只有在 focused tests、`corepack pnpm verify`、`corepack pnpm test:e2e` 和只读
live probe 通过后，才将该分支合入 `master` 并推送远程 `master`。

`.superpowers/`、本地构建产物、凭据和无关文件不得进入提交。

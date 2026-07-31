# Conflux Storage Scan 项目架构概览

> 本文是概要级说明，只覆盖主要目录与关键文件，不逐一展开全部文件。

## 1. 项目定位

Conflux Storage Scan 是一个基于 React + Vite 的前端应用，核心职责是：

- 读取 Conflux eSpace 测试网的 `Submit` 事件；
- 在浏览器本地建立 canonical 索引（IndexedDB）；
- 以仪表盘、列表、详情和图表形式展示存储数据；
- 在 `/storage` 提供分支阶段的本地 HTTP POC（链上提交 + 节点交互）。

## 2. 目录分层（概要）

```text
src/
  app/                  应用装配（Provider、QueryClient、DataSource 注入）
  routes/               路由入口（TanStack Router）
  features/             页面级功能模块（dashboard、analytics、storage-poc 等）
  components/           通用 UI 组件
  chain/                链上读取、合约身份校验、日志标准化与同步
  data/                 数据源抽象与 IndexedDB 实现
  storage/              存储 POC 运行时（prepare/upload/download/node/session）
  i18n/                 多语言资源与初始化
  wallet/               钱包链配置与连接策略
  test/                 测试工具与公共 fixture
scripts/
  harness/              只读探测、fixture 捕获与校验脚本
tests/
  e2e/                  端到端测试
  fixtures/             RPC fixture 数据
```

## 3. 应用入口与基础装配

- `src/main.tsx`  
  应用启动入口，挂载根组件和全局能力。

- `src/app/app.tsx`  
  应用壳层，组织页面骨架、全局布局与路由出口。

- `src/app/providers.tsx`  
  统一注入 React Query、数据源、存储运行时、i18n 等上下文。

- `src/app/query-client.ts`  
  QueryClient 的统一配置（缓存、重试策略等）。

## 4. 路由层（页面装配）

- `src/routes/__root.tsx`  
  根路由，承载导航、基础布局和嵌套路由容器。

- `src/routes/index.tsx`、`src/routes/submissions.tsx`、`src/routes/analytics.tsx`  
  各业务页面路由入口，将 URL 状态映射到对应 feature 页面。

- `src/routes/storage.tsx`  
  `/storage` 路由入口，承接 Storage POC 页面。

- `src/routeTree.gen.ts`  
  由路由工具生成的路由树文件（自动生成，不建议手工维护逻辑）。

## 5. Feature 层（按业务拆分）

- `src/features/dashboard/*`  
  首页概览卡片、核心统计信息展示。

- `src/features/submissions/*`  
  提交列表页（分页、状态展示）。

- `src/features/submission-detail/*`  
  单条提交详情，展示标准化后的事件字段与链上来源信息。

- `src/features/address/*`  
  按地址查看提交活动和分页结果。

- `src/features/analytics/*`  
  本地索引聚合图表（存储增长、提交趋势）。

- `src/features/storage-poc/*`  
  存储 POC 页面：上传、节点健康状态、下载校验、提示反馈。

## 6. 数据与链路核心

### 6.1 链与同步（`src/chain`）

- `src/chain/config.ts`  
  链 ID、合约地址等固定配置。

- `src/chain/proxy/verify-deployment.ts`  
  代理合约与实现身份校验，防止源头漂移导致误读。

- `src/chain/sync/sync-submissions.ts`  
  从 RPC 拉取日志并执行增量同步/重组处理。

- `src/chain/normalize/normalize-submit-log.ts`  
  将原始日志标准化为应用内部统一结构。

### 6.2 数据源与缓存（`src/data`）

- `src/data/storage-data-source.ts`  
  数据访问抽象接口，隔离上层 UI 与底层存储实现。

- `src/data/live-rpc-data-source.ts`  
  连接真实 RPC 的运行时数据源。

- `src/data/fixture-data-source.ts`  
  测试/离线场景下的 fixture 数据源。

- `src/data/indexed-db/storage-db.ts`  
  IndexedDB 表结构与读写实现。

## 7. Storage POC 运行时（`src/storage`）

- `src/storage/runtime.ts`  
  POC 运行时装配入口，聚合 prepare / upload / download / node 选择能力。

- `src/storage/sdk/prepare-file.ts`  
  文件预处理、分段与 Merkle 数据准备。

- `src/storage/upload/upload-segments.ts`  
  分段上传与重试控制。

- `src/storage/upload/upload-via-healthy-nodes.ts`  
  多健康节点上传与故障切换。

- `src/storage/upload/confirm-upload-on-nodes.ts`  
  上传后轮询确认（例如 30 秒内确认是否可见）。

- `src/storage/download/download-file.ts`  
  下载与完整性校验（Merkle Root 对齐）。

- `src/storage/node/node-pool.ts`  
  节点健康检查、可用节点筛选策略。

- `src/storage/session/upload-session.ts`  
  上传状态机（各 phase 的合法流转）。

## 9. UI 与国际化

- `src/components/*`  
  通用组件（Header、Footer、表格、图表、分页、状态组件等）。

- `src/i18n/i18n.ts`  
  i18n 初始化与语言装配。

- `src/i18n/resources/zh-CN.ts`、`src/i18n/resources/en-US.ts`  
  中英文文案资源。

## 10. 测试与工程保障

- `src/**/*.test.ts(x)`  
  单元测试与组件测试（Vitest + Testing Library）。

- `tests/e2e/*.spec.ts`  
  端到端测试（Playwright）。

- `scripts/harness/*`  
  live probe / fixture capture / harness 校验脚本。

- `README.md`  
  项目范围、运行方式、验证命令与约束说明。

---

如果你希望，我可以再补一版“**新同学 5 分钟上手路径**”（先看哪些文件、按什么顺序读代码）。

# Conflux Storage Scan 品牌与产品化打磨设计

## 背景

当前应用的链上数据、浏览器路由和响应式页面已经完整，但品牌壳层仍带有原型感：

- 页头使用通用数据库图标，不能直接表达 Conflux eSpace；
- 浏览器只引用项目自制 `favicon.svg`，没有 Apple Touch Icon 或 Web App Manifest；
- 页面标题和描述只有一份静态工程文案；
- Footer 只显示网络、只读说明和语言选择，缺少合约、源码和数据来源等信任信息；
- 部分指标说明直接暴露实现字段，表达准确但不够产品化。

本轮在不重做业务页面布局的前提下，统一品牌资产、浏览器元数据、页头、Footer 和核心文案。

## 已确认决策

| 主题 | 决策 |
| --- | --- |
| 产品名 | 保留 `Conflux Storage Scan` |
| 首页浏览器标题 | `Conflux Storage Explorer — Conflux Storage Scan` |
| 改造深度 | 品牌壳层、元数据、全站核心文案、Footer 信任信息 |
| 页面布局 | 保留现有路由、指标、图表、表格和数据状态结构 |
| 主题 | 仅 Light Theme |
| 产品行为 | 继续只读；不增加 RPC、钱包签名、下载、上传、挖矿或奖励功能 |

## 视觉与内容方向

### 视觉主张

一个具有官方 Conflux eSpace 识别度、信息密度克制且值得信任的现代存储浏览器。品牌只负责
定向和建立信任，链上数据仍是页面主角。

### 内容计划

1. 页头：官方 eSpace 标记、产品名、现有导航、搜索、网络和钱包。
2. 工作区：首页指标、图表和表格保持原有结构，只优化高频说明文案。
3. Footer：产品用途、只读状态、网络、合约、源码和语言选择。
4. 浏览器环境：正式 favicon、触控图标、manifest、页面标题和描述。

### 交互主张

- 不增加装饰性入场动画或营销式 Hero。
- 保留现有导航下划线、搜索焦点、语言弹层和 reduced-motion 行为。
- Footer 外链使用清晰的 hover/focus 状态和 External Link 图标；图标不作为唯一提示。

## 官方品牌资产

资产来自 `Conflux-Chain/sirius-eth` 提交
`f99f137fe1f1da1f08c2bd74fdac817e7e0e2b5f`，并本地托管，不在运行时依赖外部域名。

| 项目文件 | 上游文件 | SHA-256 | 用途 |
| --- | --- | --- | --- |
| `public/favicon.ico` | `public/favicon.ico` | `2e72e4569660e6b134e1c43559b9baa4ee762df2f37146fd55671c8eb0e752b7` | 浏览器标签和书签 |
| `public/logo192.png` | `public/logo192.png` | `0b70f4ed4050da15245521a10e20ef959d4895027d04c824aa10d898d0db2a1b` | Apple Touch / 192px manifest 图标 |
| `public/logo512.png` | `public/logo512.png` | `074902f14de0102a5f57d932956535818ae0ed1a037c1fecb5adcd0e446bde80` | 512px manifest 图标 |
| `public/espace-icon.svg` | `src/images/espace/icon.svg` | `5f577db55f89a8ddb06518a93af1134d95fa926d8464c4df970c65b3da7dedf4` | 页头 eSpace 品牌标记 |

线上 `https://evmtestnet.confluxscan.org/favicon.ico` 与上游 `public/favicon.ico` 的 SHA-256
完全一致。旧 `public/favicon.svg` 在新引用和测试生效后删除，避免浏览器继续命中旧资产。

## 页头品牌

- 用本地 `/espace-icon.svg` 替换 Lucide `Database`。
- 图标使用明确的 `width`、`height`，作为装饰图标使用空 `alt`；链接的可访问名称继续来自产品名。
- 保持品牌区域 32px 占位和当前页头高度，不挤压导航或搜索。
- 桌面显示完整 `Conflux Storage Scan`；平板和移动端继续仅显示图标。
- 不使用 ConfluxScan 的旧横版图、旧布局或多色星球图作为页头标志。
- 品牌链接仍返回 `/`，当前焦点和 hover 状态保持清晰。

## 浏览器元数据

`index.html` 提供不依赖 JavaScript 的英文默认值：

- `<title>`：`Conflux Storage Explorer — Conflux Storage Scan`
- Description：
  `Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet.`
- `/favicon.ico`
- `/logo192.png` Apple Touch Icon
- `/manifest.webmanifest`
- Theme color `#F0F4F3`

新增 `public/manifest.webmanifest`：

- `name`: `Conflux Storage Scan`
- `short_name`: `Storage Scan`
- `description`: 与默认页面描述一致
- `start_url`: `/`
- `display`: `standalone`
- `background_color`: `#F0F4F3`
- `theme_color`: `#F0F4F3`
- 引用 192px 和 512px 官方图标

应用运行后按当前语言和路由更新 `document.title` 与 description：

| 路由 | 英文标题 | 中文标题 |
| --- | --- | --- |
| `/` | `Conflux Storage Explorer — Conflux Storage Scan` | `Conflux 存储浏览器 — Conflux Storage Scan` |
| `/submissions` | `Storage Submissions — Conflux Storage Scan` | `存储提交记录 — Conflux Storage Scan` |
| `/submission/:sequence` | `Submission #{{sequence}} — Conflux Storage Scan` | `提交 #{{sequence}} — Conflux Storage Scan` |
| `/address/:address` | `Address {{shortAddress}} — Conflux Storage Scan` | `地址 {{shortAddress}} — Conflux Storage Scan` |
| `/history` | `My Submissions — Conflux Storage Scan` | `我的提交 — Conflux Storage Scan` |
| `/analytics` | `Storage Analytics — Conflux Storage Scan` | `存储分析 — Conflux Storage Scan` |
| 其他 | `Explorer Page — Conflux Storage Scan` | `浏览器页面 — Conflux Storage Scan` |

动态元数据是纯本地派生状态，不读取数据源，不发起 RPC。地址标题只显示首尾缩写，避免标题过长。

## 核心文案

保持现有技术语义，只优化高频产品表达：

| 位置 | 英文 | 中文 |
| --- | --- | --- |
| 首页 eyebrow | `Conflux eSpace Storage` | `Conflux eSpace 存储` |
| 首页说明 | `Explore canonical FixedPriceFlow submissions indexed from Conflux eSpace Testnet.` | `浏览从 Conflux eSpace 测试网索引的 FixedPriceFlow 规范存储提交。` |
| 搜索标签 | `Search by submission sequence or submitter address` | `按提交序号或提交者地址搜索` |
| 搜索 placeholder | `Sequence 484 or 0x… submitter` | `提交序号 484 或 0x… 提交者地址` |
| 合约提交说明 | `FixedPriceFlow sequence counter` | `FixedPriceFlow 提交序号计数` |
| 已索引说明 | `Validated canonical Submit events` | `已验证的规范 Submit 事件` |
| 逻辑数据说明 | `Total bytes declared by indexed submissions` | `已索引提交声明的逻辑字节总量` |
| 存储费用说明 | `No storage fee on this testnet` | `当前测试网不收取存储费用` |
| Footer 简介 | `Read-only explorer for FixedPriceFlow storage submissions.` | `FixedPriceFlow 存储提交的只读浏览器。` |
| 只读标记 | `Read-only` | `只读` |

不修改 `Submission Identity`、`Submitter`、逻辑字节、扇区、`Indexed on eSpace` 和
`0 CFX` 等已验证术语。

## Footer 信任信息

Footer 改为紧凑的两层信息结构，不做 ConfluxScan 式大型站点地图：

### 第一层

- 产品名 `Conflux Storage Scan`
- Footer 简介
- `Read-only / 只读` 状态标记

### 第二层

- `Conflux eSpace Testnet`，链接到 `https://evmtestnet.confluxscan.org/`
- `FixedPriceFlow 0x3fF0…7199`，链接到
  `https://evmtestnet.confluxscan.org/address/0x3fF03285AA79027Ecc552432336FCB85eaD7199e`
- `GitHub`，链接到 `https://github.com/cryptosunshine/conflux-storage-scan`
- 现有语言选择器

全部外链在新标签页打开并使用 `rel="noopener noreferrer"`。桌面端在单个紧凑 Footer
内分组对齐；390px 下按品牌、信任链接、语言选择顺序堆叠，不允许横向溢出。

## 组件边界

- `AppHeader`：只负责页头品牌和现有导航组合。
- `AppFooter`：只负责 Footer 内容与外链。
- `RouteMetadata`：只根据当前路由和 i18n 生成标题、描述，不访问 `StorageDataSource`。
- 翻译资源：保存所有新增可见文案和路由标题模板。
- 静态资产与 `manifest.webmanifest`：由 Vite 原样发布。

页面、图表、表格和数据查询组件不感知品牌资产或元数据实现。

## 错误与降级

- favicon、触控图标和 manifest 都是本地静态文件，没有运行时网络失败路径。
- 页头品牌文字始终存在；即使图标加载失败，导航的可访问名称和产品识别仍可用。
- `RouteMetadata` 遇到未知路由时使用通用标题，不抛出错误。
- Footer 外链不可用不会影响任何浏览、搜索、缓存或钱包流程。

## TDD 与验证

1. 先增加失败测试，覆盖默认 HTML 标题、description、favicon、Touch Icon 和 manifest。
2. 增加失败组件测试，要求页头使用 eSpace 图标，不再渲染通用数据库 SVG。
3. 增加失败测试，覆盖中英文路由标题、搜索文案和 Footer 信任链接。
4. 实施最小组件、元数据、资产和文案修改。
5. 验证切换语言会更新标题和 description，URL 与 RPC 请求数不变。
6. 在 1440px、1024px、390px 实机检查页头、Footer、外链焦点和横向溢出。
7. 按 Web Interface Guidelines 审查变更文件。
8. 运行 `corepack pnpm harness:validate`、`corepack pnpm verify` 和
   `corepack pnpm test:e2e`。

## 非目标

- 不重做首页、指标卡、图表或表格布局。
- 不增加营销 Hero、公告、博客、社交媒体列表或大型 Footer 导航。
- 不增加 PWA Service Worker、离线安装提示或推送通知。
- 不复制 ConfluxScan 的旧版页面结构。
- 不新增 RPC、分析埋点、Cookie 或外部运行时资源。

## 验收标准

- 浏览器标签、收藏、桌面/移动安装图标使用已固定的官方资产。
- 页头不再显示通用数据库图标，品牌在三种目标宽度下清晰且不挤压现有操作。
- 首页与高频说明文案更接近正式产品表达，并保持中英文语义一致。
- 每个公开路由和 `/history` 都有准确的本地化浏览器标题。
- Footer 清晰说明网络、合约、源码和只读属性，所有外链安全、可聚焦。
- 产品只读约束、`0 CFX`、公开路由免钱包和零额外 RPC 保持不变。
- 全部测试和质量门禁通过，远程 `master` 最终包含本次变更。

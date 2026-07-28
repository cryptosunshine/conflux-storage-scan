# Conflux Storage Scan MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个只读的 Conflux eSpace 测试网存储浏览器，包含 FixedPriceFlow 事件索引、IndexedDB 增量缓存、自动 fixture 捕获、RainbowKit 钱包、0G 参考路由、Conflux Light Theme，以及可重复的故障测试。

**Architecture:** 应用是 Vite + React SPA。`LiveRpcDataSource` 通过 viem 读取已验证的 BeaconProxy 和 `Submit` 日志，标准化后写入 IndexedDB；UI 只依赖 `StorageDataSource`，测试可切换为 `FixtureDataSource`。TanStack Router 管理路由，TanStack Query 管理异步状态，RainbowKit/wagmi 只负责可选钱包连接，不参与公开链数据读取。

**Tech Stack:** pnpm 11、Vite 8、React 19、TypeScript 5.9、TanStack Router/Query、Tailwind CSS 4、Biome 2、viem 2、RainbowKit 2、wagmi 2、idb 8、Vitest 4、Testing Library、MSW 2、Playwright 1。

---

## 0. 实施约束与版本基线

实施前必须阅读：

- `docs/superpowers/specs/2026-07-27-conflux-storage-scan-design.zh-CN.md`
- `docs/superpowers/specs/2026-07-27-conflux-storage-scan-design.md`

当前依赖基线来自 2026-07-28 npm registry：

| Package | Version |
| --- | --- |
| `pnpm` | `11.17.0` |
| `vite` | `8.1.5` |
| `react` / `react-dom` | `19.2.8` |
| `typescript` | `5.9.3` |
| `@vitejs/plugin-react` | `6.0.4` |
| `@tanstack/react-router` | `1.170.18` |
| `@tanstack/router-plugin` | `1.168.23` |
| `@tanstack/react-query` | `5.101.4` |
| `tailwindcss` / `@tailwindcss/vite` | `4.3.3` |
| `viem` | `2.55.10` |
| `@rainbow-me/rainbowkit` | `2.2.11` |
| `wagmi` | `2.19.5` |
| `idb` | `8.0.3` |
| `@biomejs/biome` | `2.5.5` |
| `@types/node` | `24.13.3` |
| `vitest` | `4.1.10` |
| `msw` | `2.15.0` |
| `@playwright/test` | `1.62.0` |

RainbowKit `2.2.11` 的 peer dependency 要求 wagmi `^2.9.0`，所以必须使用最新兼容的
wagmi 2.x，不得直接升级到 wagmi 3。

RainbowKit/wagmi 的 Coinbase/Solana 间接依赖尚未声明 TypeScript 7 兼容，因此使用最新兼容的
TypeScript `5.9.3`。`valtio` 的旧传递依赖统一覆盖为支持 React 19 的
`use-sync-external-store@1.6.0`。

已验证的链常量：

```ts
export const CONFLUX_ESPACE_TESTNET_CHAIN_ID = 71
export const FIXED_PRICE_FLOW_PROXY = "0x3fF03285AA79027Ecc552432336FCB85eaD7199e"
export const FIXED_PRICE_FLOW_BEACON = "0x7322ba93f0b6061c6fce1af4ac5264cb252a0166"
export const FIXED_PRICE_FLOW_IMPLEMENTATION = "0xAd85554aa3446F7199644F852eC7bBa706af3eF9"
export const FIXED_PRICE_FLOW_MARKET = "0xB43eE2d86c4Ccb1e958a77a4c52937Cc22255Ac1"
export const FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK = 253_160_870n
export const STORAGE_SECTOR_BYTES = 256n
export const STORAGE_FEE_CFX = 0n
export const REORG_LOOKBACK_BLOCKS = 128n
```

`FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK` 已通过 `eth_getCode` 二分验证：

- 区块 `253160869`：代码为 `0x`
- 区块 `253160870`：代理代码存在

开始 Task 1 前，实施会话必须加载 `superpowers:using-git-worktrees`，从包含本计划的提交创建
`codex/conflux-storage-scan-mvp` 分支和隔离 worktree。`.superpowers/` 是本地 brainstorming
临时目录，不得复制、暂存或提交。

MVP 不配置 CI；实施过程中不得创建 `.github/workflows/` 或其他 CI 平台配置。

## 1. 目标文件结构

```text
.
├── .agents/skills/
│   ├── design-conflux-storage-ui/SKILL.md
│   ├── develop-conflux-storage-data/SKILL.md
│   └── integrate-rainbowkit-wallets/SKILL.md
├── AGENTS.md
├── biome.json
├── index.html
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── scripts/validate-agent-harness.mjs
├── scripts/harness/
│   ├── capture.ts
│   ├── probe.ts
│   └── lib/
│       ├── checksums.ts
│       ├── fixture-writer.ts
│       ├── manifest.ts
│       └── rpc.ts
├── src/
│   ├── app/
│   │   ├── app.tsx
│   │   ├── providers.tsx
│   │   └── query-client.ts
│   ├── chain/
│   │   ├── abi/
│   │   │   ├── beacon.ts
│   │   │   └── fixed-price-flow.ts
│   │   ├── client.ts
│   │   ├── config.ts
│   │   ├── normalize/
│   │   │   ├── normalize-submit-log.test.ts
│   │   │   ├── normalize-submit-log.ts
│   │   │   ├── submission-identity.test.ts
│   │   │   └── submission-identity.ts
│   │   ├── proxy/
│   │   │   ├── verify-deployment.test.ts
│   │   │   └── verify-deployment.ts
│   │   ├── sync/
│   │   │   ├── adaptive-ranges.test.ts
│   │   │   ├── adaptive-ranges.ts
│   │   │   ├── sync-submissions.test.ts
│   │   │   └── sync-submissions.ts
│   │   └── types.ts
│   ├── components/
│   │   ├── address-link.tsx
│   │   ├── app-header.tsx
│   │   ├── copy-button.tsx
│   │   ├── data-state.tsx
│   │   ├── metric-card.tsx
│   │   ├── pagination.tsx
│   │   ├── submission-table.tsx
│   │   └── sync-status.tsx
│   ├── data/
│   │   ├── fixture-data-source.ts
│   │   ├── indexed-db/
│   │   │   ├── storage-db.test.ts
│   │   │   └── storage-db.ts
│   │   ├── live-rpc-data-source.ts
│   │   ├── queries.ts
│   │   └── storage-data-source.ts
│   ├── features/
│   │   ├── address/address-page.tsx
│   │   ├── dashboard/dashboard-page.tsx
│   │   ├── recovery/
│   │   │   ├── rebuild-index-button.tsx
│   │   │   └── recovery.test.tsx
│   │   ├── search/global-search.test.tsx
│   │   ├── search/global-search.tsx
│   │   ├── submission-detail/submission-detail-page.tsx
│   │   ├── submissions/submissions-page.tsx
│   │   └── wallet-history/wallet-history-page.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── address.$address.tsx
│   │   ├── history.tsx
│   │   ├── index.tsx
│   │   ├── submission.$sequence.tsx
│   │   └── submissions.tsx
│   ├── styles/index.css
│   ├── test/
│   │   ├── handlers.ts
│   │   ├── render.tsx
│   │   ├── server.ts
│   │   ├── smoke.test.tsx
│   │   └── setup.ts
│   ├── wallet/
│   │   ├── chains.ts
│   │   ├── config.test.ts
│   │   └── config.ts
│   ├── main.tsx
│   └── routeTree.gen.ts
├── tests/
│   ├── e2e/
│   │   ├── explorer.spec.ts
│   │   ├── mobile.spec.ts
│   │   └── wallet.spec.ts
│   └── fixtures/rpc/conflux-espace-testnet/fixed-price-flow/
│       └── v1/
│           ├── manifest.json
│           ├── captures/
│           ├── expected/
│           ├── faults/
│           └── synthetic/
└── README.md
```

## Task 1: 搭建 Vite、TypeScript、Biome 和测试基线

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `biome.json`
- Create: `index.html`
- Create: `src/app/app.tsx`
- Create: `src/main.tsx`
- Create: `src/styles/index.css`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.tsx`

- [x] **Step 1: 写出项目 manifest**

`package.json` 必须包含固定版本和本地门禁：

```json
{
  "name": "conflux-storage-scan",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@11.17.0",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "harness:probe": "tsx scripts/harness/probe.ts",
    "harness:capture": "tsx scripts/harness/capture.ts"
  },
  "dependencies": {
    "@rainbow-me/rainbowkit": "2.2.11",
    "@tanstack/react-query": "5.101.4",
    "@tanstack/react-router": "1.170.18",
    "clsx": "2.1.1",
    "idb": "8.0.3",
    "lucide-react": "1.27.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "viem": "2.55.10",
    "wagmi": "2.19.5"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.5",
    "@playwright/test": "1.62.0",
    "@tailwindcss/vite": "4.3.3",
    "@tanstack/router-plugin": "1.168.23",
    "@testing-library/jest-dom": "7.0.0",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "24.13.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.4",
    "fake-indexeddb": "6.2.5",
    "happy-dom": "20.11.1",
    "msw": "2.15.0",
    "tailwindcss": "4.3.3",
    "tsx": "4.23.1",
    "typescript": "5.9.3",
    "vite": "8.1.5",
    "vitest": "4.1.10"
  }
}
```

pnpm 11 的 override 配置写入 `pnpm-workspace.yaml`：

```yaml
overrides:
  use-sync-external-store: 1.6.0
```

- [x] **Step 2: 写 TypeScript、Vite、Vitest 和 Biome 配置**

使用以下关键配置：

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss(), react()],
})
```

TanStack Router 插件在 Task 10 创建首个 `src/routes` 文件时加入，避免基础阶段扫描不存在的
路由目录。

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
})
```

`tsconfig.app.json` 启用 `strict`、`noUnusedLocals`、`noUnusedParameters`、
`noUncheckedSideEffectImports`、`verbatimModuleSyntax` 和 `moduleResolution: "bundler"`。
`biome.json` 使用 Tab 缩进、双引号、自动整理 imports，并忽略 `src/routeTree.gen.ts`。

- [x] **Step 3: 写失败的 React smoke test**

```tsx
// src/test/smoke.test.tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "../app/app"

describe("App", () => {
  it("renders the product name", () => {
    render(<App />)
    expect(screen.getByText("Conflux Storage Scan")).toBeInTheDocument()
  })
})
```

- [x] **Step 4: 安装依赖并确认测试按预期失败**

Run:

```bash
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
pnpm test src/test/smoke.test.tsx
```

Expected: FAIL，错误为无法解析 `../app/app`。

- [x] **Step 5: 写最小 App 和入口**

```tsx
// src/app/app.tsx
export function App() {
  return <h1>Conflux Storage Scan</h1>
}
```

```tsx
// src/main.tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/app"
import "./styles/index.css"

const root = document.getElementById("root")

if (!root) {
  throw new Error("Missing #root application mount")
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Task 1 的 `src/styles/index.css` 只写入 `@import "tailwindcss";`，Task 9 再加入完整设计令牌。
`src/test/setup.ts` 导入 `@testing-library/jest-dom/vitest` 和 `fake-indexeddb/auto`。

- [x] **Step 6: 运行基线门禁**

Run: `pnpm test src/test/smoke.test.tsx && pnpm typecheck && pnpm build`

Expected: 全部退出码为 0。

- [x] **Step 7: 提交**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json vite.config.ts vitest.config.ts biome.json index.html src
git commit -m "chore: scaffold Conflux storage scan"
```

## Task 2: 建立 AGENTS.md 和三个项目 Skills

**Files:**

- Create: `AGENTS.md`
- Create: `.agents/skills/develop-conflux-storage-data/SKILL.md`
- Create: `.agents/skills/integrate-rainbowkit-wallets/SKILL.md`
- Create: `.agents/skills/design-conflux-storage-ui/SKILL.md`
- Create: `scripts/validate-agent-harness.mjs`
- Modify: `package.json`

- [x] **Step 1: 加载创建 Skill 所需规范**

实施者必须先加载：

- `skill-creator`
- `superpowers:writing-skills`

不得凭记忆编写 `SKILL.md`。

- [x] **Step 2: 先写失败的 Harness 校验脚本**

```js
// scripts/validate-agent-harness.mjs
import { access, readFile } from "node:fs/promises"

const required = [
  "AGENTS.md",
  ".agents/skills/develop-conflux-storage-data/SKILL.md",
  ".agents/skills/integrate-rainbowkit-wallets/SKILL.md",
  ".agents/skills/design-conflux-storage-ui/SKILL.md",
]

for (const file of required) {
  await access(file)
  const text = await readFile(file, "utf8")
  if (text.includes("TODO") || text.includes("TBD")) {
    throw new Error(`${file} contains a placeholder`)
  }
}

console.log(`Validated ${required.length} agent harness files`)
```

在 `package.json` 增加：

```json
"harness:validate": "node scripts/validate-agent-harness.mjs"
```

- [x] **Step 3: 运行校验并确认失败**

Run: `pnpm harness:validate`

Expected: FAIL，首个缺失文件为 `AGENTS.md`。

- [x] **Step 4: 编写根 AGENTS.md**

内容必须明确：

```markdown
# Conflux Storage Scan project instructions

- Product is read-only. Never add upload, download, mining, reward, signing, or contract-write behavior.
- Storage fee is the constant `0 CFX`; never call pricing methods.
- Chain truth comes from eSpace testnet chain ID 71, the deployed BeaconProxy, verified implementation source, and pinned ABI fixtures.
- UI code depends on `StorageDataSource`; routes must not call RPC directly.
- Use strict TypeScript, Biome, TanStack Router/Query, Tailwind, viem, RainbowKit, and wagmi 2.
- Chain/RPC/cache work requires `develop-conflux-storage-data`.
- Wallet/EIP-6963 work requires `integrate-rainbowkit-wallets`.
- Page/component/style work requires `design-conflux-storage-ui`.
- Cross-domain changes load every matching skill.
- Follow TDD. Run `pnpm verify`; run `pnpm test:e2e` for user-flow changes.
- Live commands are `pnpm harness:probe` and `pnpm harness:capture`; deterministic tests never call live RPC.
- Never overwrite an accepted fixture version or automatically commit/push captured fixtures.
```

- [x] **Step 5: 编写三个 Skills**

每个 `SKILL.md` 使用有效 frontmatter，描述中包含准确触发条件。正文必须包含设计 Spec
第 14.2 节对应的不变量、推荐工作流、需要读取的项目文件和完成前验证命令。

数据 Skill 明确 `sender == submission.submitter`、逻辑字节与扇区差异、256 字节扇区、
批量提交、Beacon 严格模式和 fee 禁止调用。

钱包 Skill 明确 RainbowKit `2.2.11` + wagmi `2.19.5`、EIP-6963、
`multiInjectedProviderDiscovery`、公开 client 与钱包 provider 解耦、MVP 不签名不写链。

UI Skill 明确支持的五条路由、Light Theme、全部精确色值、无下载/挖矿 UI、
响应式表格和所有数据状态。

- [x] **Step 6: 校验 Skills**

Run:

```bash
pnpm harness:validate
rg -n "pricePerSector|EIP-6963|Light Theme|pnpm verify" AGENTS.md .agents/skills
```

Expected: 校验输出 `Validated 4 agent harness files`，四类关键规则均能检索到。

- [x] **Step 7: 提交**

```bash
git add AGENTS.md .agents/skills scripts/validate-agent-harness.mjs package.json
git commit -m "chore: add project agent harness"
```

## Task 3: 固定链配置、窄 ABI 和 BeaconProxy 校验

**Files:**

- Create: `src/chain/config.ts`
- Create: `src/chain/client.ts`
- Create: `src/chain/abi/fixed-price-flow.ts`
- Create: `src/chain/abi/beacon.ts`
- Create: `src/chain/proxy/verify-deployment.test.ts`
- Create: `src/chain/proxy/verify-deployment.ts`

- [x] **Step 1: 写 Beacon 校验失败测试**

```ts
// src/chain/proxy/verify-deployment.test.ts
import { describe, expect, it, vi } from "vitest"
import { verifyDeployment } from "./verify-deployment"

describe("verifyDeployment", () => {
  it("blocks an unexpected implementation", async () => {
    const client = {
      getChainId: vi.fn().mockResolvedValue(71),
      getBytecode: vi.fn().mockResolvedValue("0x6000"),
      getStorageAt: vi.fn().mockResolvedValue(
        "0x0000000000000000000000007322ba93f0b6061c6fce1af4ac5264cb252a0166",
      ),
      readContract: vi.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
    }

    await expect(verifyDeployment(client as never)).rejects.toMatchObject({
      code: "IMPLEMENTATION_MISMATCH",
    })
  })
})
```

- [x] **Step 2: 运行并确认失败**

Run: `pnpm test src/chain/proxy/verify-deployment.test.ts`

Expected: FAIL，无法解析 `./verify-deployment`。

- [x] **Step 3: 编写配置和窄 ABI**

`fixedPriceFlowAbi` 只包含：

```ts
export const fixedPriceFlowAbi = [
  {
    type: "event",
    name: "Submit",
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "identity", type: "bytes32" },
      { indexed: false, name: "submissionIndex", type: "uint256" },
      { indexed: false, name: "startPos", type: "uint256" },
      { indexed: false, name: "length", type: "uint256" },
      {
        indexed: false,
        name: "submission",
        type: "tuple",
        components: [
          { name: "length", type: "uint256" },
          { name: "tags", type: "bytes" },
          {
            name: "nodes",
            type: "tuple[]",
            components: [
              { name: "root", type: "bytes32" },
              { name: "height", type: "uint256" },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "submissionIndex",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tree",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "currentLength", type: "uint256" },
      { name: "unstagedHeight", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "market",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getFlowRootByTxSeq",
    stateMutability: "view",
    inputs: [{ name: "txSeq", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
] as const
```

不要加入 `pricePerSector`、`submit`、`batchSubmit` 或 mining 方法。

- [x] **Step 4: 实现严格 Beacon 验证**

`verifyDeployment()` 必须：

1. 校验 chain ID 为 71；
2. 校验 proxy 和 beacon 均存在代码；
3. 读取 EIP-1967 Beacon slot
   `0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50`；
4. 调用 Beacon 的 `implementation()`；
5. 对比预期实现地址；
6. 调用 `market()` 并对比预期 Market；
7. 返回包含 proxy/beacon/implementation/market 的只读 identity。

错误使用可判别 code：

```ts
export type DeploymentErrorCode =
  | "CHAIN_ID_MISMATCH"
  | "PROXY_CODE_MISSING"
  | "BEACON_MISMATCH"
  | "BEACON_CODE_MISSING"
  | "IMPLEMENTATION_MISMATCH"
  | "MARKET_MISMATCH"
```

- [x] **Step 5: 运行测试**

Run:

```bash
pnpm test src/chain/proxy/verify-deployment.test.ts
pnpm typecheck
```

Expected: PASS。

- [x] **Step 6: 提交**

```bash
git add src/chain
git commit -m "feat: verify FixedPriceFlow deployment"
```

## Task 4: 标准化 Submit 日志并固定领域类型

**Files:**

- Create: `src/chain/types.ts`
- Create: `src/chain/normalize/submission-identity.ts`
- Create: `src/chain/normalize/submission-identity.test.ts`
- Create: `src/chain/normalize/normalize-submit-log.ts`
- Create: `src/chain/normalize/normalize-submit-log.test.ts`
- Create: `tests/fixtures/unit/submit-log.json`

- [x] **Step 1: 写提交标识测试**

```ts
import { describe, expect, it } from "vitest"
import { calculateSubmissionIdentity } from "./submission-identity"

describe("calculateSubmissionIdentity", () => {
  it("hashes packed node roots in order", () => {
    const roots = [
      `0x${"11".repeat(32)}`,
      `0x${"22".repeat(32)}`,
    ] as const

    expect(calculateSubmissionIdentity(roots)).toMatch(/^0x[0-9a-f]{64}$/)
    expect(calculateSubmissionIdentity(roots)).not.toBe(calculateSubmissionIdentity([...roots].reverse()))
  })
})
```

- [x] **Step 2: 写标准化失败测试**

测试必须断言：

- `sender` 映射到 `submitter`；
- `submission.length` 映射到 `logicalSizeBytes`；
- 顶层 `length` 映射到 `sectorCount`；
- `endSectorExclusive = startPos + length`；
- 一笔交易的不同 `logIndex` 得到不同 canonical key；
- 事件 identity 与节点 roots 计算结果不一致时拒绝数据；
- 缺失 `blockTimestamp` 时要求外部提供区块时间戳。

- [x] **Step 3: 运行并确认失败**

Run:

```bash
pnpm test src/chain/normalize/submission-identity.test.ts
pnpm test src/chain/normalize/normalize-submit-log.test.ts
```

Expected: FAIL，目标模块尚不存在。

- [x] **Step 4: 实现领域类型**

```ts
export interface StorageSubmission {
  canonicalKey: string
  chainId: 71
  contractAddress: `0x${string}`
  implementationAddress: `0x${string}`
  sequence: bigint
  submitter: `0x${string}`
  submissionIdentity: `0x${string}`
  logicalSizeBytes: bigint
  startSector: bigint
  sectorCount: bigint
  endSectorExclusive: bigint
  nodeRoots: readonly `0x${string}`[]
  tags: `0x${string}`
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  transactionIndex: number
  logIndex: number
  transactionLogIndex?: number
  timestamp: number
}
```

`calculateSubmissionIdentity()` 使用 viem 的 `keccak256(concat(nodeRoots))`。
`normalizeSubmitLog()` 校验 identity、地址、必需区块字段和安全的时间戳格式。

- [x] **Step 5: 运行测试和类型检查**

Run: `pnpm test src/chain/normalize && pnpm typecheck`

Expected: PASS。

- [x] **Step 6: 提交**

```bash
git add src/chain/types.ts src/chain/normalize tests/fixtures
git commit -m "feat: normalize storage submissions"
```

## Task 5: 实现 live probe 和不可变 fixture 自动捕获

**Files:**

- Create: `scripts/harness/lib/rpc.ts`
- Create: `scripts/harness/lib/checksums.ts`
- Create: `scripts/harness/lib/manifest.ts`
- Create: `scripts/harness/lib/fixture-writer.ts`
- Create: `scripts/harness/lib/fixture-writer.test.ts`
- Create: `scripts/harness/probe.ts`
- Create: `scripts/harness/capture.ts`
- Create: `tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1/manifest.json`

- [x] **Step 1: 写 fixture writer 失败测试**

使用临时目录测试：

```ts
it("selects the next version and never overwrites an accepted version", async () => {
  await mkdir(join(root, "v1"), { recursive: true })
  const version = await nextFixtureVersion(root)
  expect(version).toBe("v2")
  await expect(publishFixture(root, "v1", payload)).rejects.toMatchObject({
    code: "FIXTURE_EXISTS",
  })
})
```

再测试失败校验不会留下 `vN` 或临时目录。

- [x] **Step 2: 运行并确认失败**

Run: `pnpm test scripts/harness/lib/fixture-writer.test.ts`

Expected: FAIL，fixture writer 不存在。

- [x] **Step 3: 实现严格 JSON-RPC client**

`rpc.ts`：

- 只接受显式 URL；
- 设置超时；
- 检查 HTTP 状态和 JSON-RPC error；
- 不记录 headers；
- 为 capture 返回脱敏后的 `{ method, params, result }`；
- 禁止调用集合中包含 `pricePerSector`、`eth_sendTransaction`、
  `eth_sendRawTransaction`。

- [x] **Step 4: 实现 probe**

`pnpm harness:probe` 必须执行：

```text
eth_chainId
eth_getCode(proxy)
eth_getStorageAt(proxy, EIP-1967 beacon slot)
eth_getCode(beacon)
eth_call beacon.implementation()
eth_call proxy.market()
eth_call proxy.paused()
eth_call proxy.submissionIndex()
eth_call proxy.tree()
eth_getLogs(从 deployment block 到 latest，分段)
```

输出一行摘要：

```text
chain=71 proxy=ok beacon=ok implementation=ok submissions=<n> logs=<n> paused=false
```

probe 只读且不写 fixture。

- [x] **Step 5: 实现 capture 的原子发布**

`capture.ts` 复用 probe，生成：

- `manifest.json`
- `captures/requests.json`
- `captures/responses.json`
- `expected/submissions.json`
- `expected/summary.json`

所有 `bigint` 转十进制字符串。先写同级 `.vN.tmp-<pid>`，完成 checksum 和不变量校验后，
使用 `rename()` 原子发布为 `vN`。目标存在立即失败。进程失败时删除自己的临时目录，
但绝不能删除任何 `vN`。

- [x] **Step 6: 捕获 v1 并人工检查**

Run:

```bash
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com pnpm harness:probe
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com pnpm harness:capture
```

Expected:

- probe chain 为 71；
- proxy、beacon、implementation、market 全部匹配；
- 自动创建首个未使用版本；
- manifest 不包含 RPC URL 凭据；
- 第二次 capture 创建下一个版本，而不是覆盖前一个。

只将一个经过评审的基线版本加入当前提交；额外验证版本可保留在工作区供对比后删除，
删除目标必须是本次命令明确创建的临时验证版本。

- [x] **Step 7: 运行 deterministic tests**

Run: `pnpm test scripts/harness && pnpm harness:validate`

Expected: PASS，且测试不访问网络。

- [x] **Step 8: 提交**

```bash
git add scripts/harness tests/fixtures package.json
git commit -m "feat: add immutable RPC fixture capture"
```

## Task 6: 实现 IndexedDB 仓库与链重组对账

**Files:**

- Create: `src/data/indexed-db/storage-db.ts`
- Create: `src/data/indexed-db/storage-db.test.ts`

- [ ] **Step 1: 写数据库失败测试**

使用 `fake-indexeddb` 测试：

```ts
it("replaces orphaned logs and checkpoint atomically", async () => {
  await repository.applyChunk({
    fromBlock: 100n,
    toBlock: 110n,
    canonicalBlockHashes: new Map([[110n, oldHash]]),
    submissions: [oldSubmission],
  })

  await repository.reconcileWindow({
    fromBlock: 105n,
    toBlock: 112n,
    canonicalBlockHashes: new Map([[110n, newHash]]),
    submissions: [replacementSubmission],
  })

  expect(await repository.getByCanonicalKey(oldSubmission.canonicalKey)).toBeUndefined()
  expect(await repository.getBySequence(1n)).toEqual(replacementSubmission)
  expect(await repository.getCheckpoint()).toMatchObject({ blockNumber: 112n })
})
```

还要测试 schema/implementation/normalizer 版本不兼容时打开新 namespace。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm test src/data/indexed-db/storage-db.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现数据库 schema**

使用 `idb`，stores 为：

```text
submissions: key=canonicalKey, indexes=sequence, submitter, blockNumber
blocks: key=blockHash, indexes=blockNumber
meta: key=name
```

持久化记录中的 bigint 全部转十进制字符串。repository 对外返回 bigint。

必须提供：

```ts
interface StorageRepository {
  applyChunk(chunk: CanonicalChunk): Promise<void>
  reconcileWindow(chunk: CanonicalChunk): Promise<void>
  list(query: ListQuery): Promise<Page<StorageSubmission>>
  listBySubmitter(query: AddressListQuery): Promise<Page<StorageSubmission>>
  getBySequence(sequence: bigint): Promise<StorageSubmission | undefined>
  getSummary(): Promise<IndexedSummary>
  getCheckpoint(): Promise<SyncCheckpoint | undefined>
  clearCurrentNamespace(): Promise<void>
}
```

- [ ] **Step 4: 实现重组对账**

在单个 readwrite transaction 中：

1. 找出窗口内 block hash 不在新 canonical map 的记录；
2. 删除孤块 submissions 和 blocks；
3. upsert 新 canonical blocks；
4. upsert 新 submissions；
5. 校验同一 sequence 只有一条 canonical 记录；
6. 更新 checkpoint。

- [ ] **Step 5: 运行测试**

Run: `pnpm test src/data/indexed-db && pnpm typecheck`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/data/indexed-db
git commit -m "feat: persist canonical submission index"
```

## Task 7: 实现自适应日志同步与故障恢复

**Files:**

- Create: `src/chain/sync/adaptive-ranges.ts`
- Create: `src/chain/sync/adaptive-ranges.test.ts`
- Create: `src/chain/sync/sync-submissions.ts`
- Create: `src/chain/sync/sync-submissions.test.ts`
- Create: `tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1/faults/*.json`

- [ ] **Step 1: 写自适应范围失败测试**

断言：

- 成功两次后扩大范围；
- 429、超时或 response-too-large 后范围减半；
- 最小范围仍失败时返回带 block range 的 typed error；
- retry 使用指数退避和可注入 jitter；
- abort signal 立即停止。

- [ ] **Step 2: 写同步失败测试**

使用 fixture transport 断言：

- 从 deployment block 首次同步；
- 从 checkpoint 继续；
- 每次刷新回看 128 个区块；
- 重复和乱序日志只生成一条 canonical 记录；
- `removed: true` 被移除；
- `blockTimestamp` 缺失时按 block hash 去重请求区块；
- partial batch、malformed event、sequence gap 产生 `partial` 状态；
- implementation mismatch 产生 `incompatible-contract` 并且不写新数据。

- [ ] **Step 3: 运行并确认失败**

Run: `pnpm test src/chain/sync`

Expected: FAIL，目标模块不存在。

- [ ] **Step 4: 实现同步状态机**

```ts
export type SyncState =
  | { status: "idle" }
  | { status: "syncing"; fromBlock: bigint; toBlock: bigint }
  | { status: "fresh"; headBlock: bigint; syncedAt: number }
  | { status: "stale"; lastSuccessAt: number; error: RpcFailure }
  | { status: "partial"; lastSuccessAt?: number; gaps: readonly bigint[]; error: RpcFailure }
  | { status: "incompatible-contract"; error: DeploymentError }
```

`syncSubmissions()` 先执行 deployment verify，再计算
`max(deploymentBlock, checkpoint.blockNumber - 127n)`，分段请求日志，
为缺失时间戳的不同 block hash 批量补充区块，并通过 repository 原子写入。

- [ ] **Step 5: 加入 fault fixtures**

提供确定性文件：

```text
429.json
timeout.json
pruned-range.json
oversized-range.json
partial-batch.json
duplicates.json
out-of-order.json
removed.json
reorg.json
malformed-submit.json
sequence-gap.json
invalid-block-timestamp.json
missing-enriched-fields.json
implementation-changed.json
wrong-chain.json
```

- [ ] **Step 6: 运行同步测试**

Run: `pnpm test src/chain/sync --coverage=false && pnpm typecheck`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/chain/sync tests/fixtures
git commit -m "feat: sync storage logs with reorg recovery"
```

## Task 8: 建立 StorageDataSource、Query hooks 和缓存恢复

**Files:**

- Create: `src/data/storage-data-source.ts`
- Create: `src/data/live-rpc-data-source.ts`
- Create: `src/data/fixture-data-source.ts`
- Create: `src/data/queries.ts`
- Create: `src/data/storage-data-source.test.ts`
- Create: `src/app/query-client.ts`

- [ ] **Step 1: 写数据源 contract tests**

同一组 contract tests 分别运行于 `FixtureDataSource` 和基于 mock RPC + fake IndexedDB 的
`LiveRpcDataSource`，断言：

```ts
export interface StorageDataSource {
  sync(signal?: AbortSignal): Promise<SyncState>
  getSyncState(): SyncState
  getSummary(): Promise<StorageSummary>
  listSubmissions(query: ListSubmissionsQuery): Promise<Page<StorageSubmission>>
  getSubmission(sequence: bigint): Promise<StorageSubmission | undefined>
  listBySubmitter(query: AddressListSubmissionsQuery): Promise<Page<StorageSubmission>>
  rebuildLocalIndex(): Promise<void>
}
```

分页固定按 sequence 降序。页码从 1 开始，默认每页 20 条。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm test src/data/storage-data-source.test.ts`

Expected: FAIL，接口和实现不存在。

- [ ] **Step 3: 实现数据源**

`LiveRpcDataSource` 组合 public client、repository 和 sync service。
`FixtureDataSource` 读取已标准化的 fixture JSON，不访问 IndexedDB 或网络。

`StorageSummary` 必须包含：

```ts
interface StorageSummary {
  contractSubmissionCount: bigint
  indexedSubmissionCount: bigint
  indexedLogicalBytes: bigint
  allocatedSectorCount: bigint
  allocatedBytes: bigint
  storageFeeCfx: 0n
  latestBlock?: bigint
}
```

- [ ] **Step 4: 实现 Query factories**

Query keys 必须稳定：

```ts
export const storageKeys = {
  all: ["storage"] as const,
  summary: () => [...storageKeys.all, "summary"] as const,
  submissions: (page: number) => [...storageKeys.all, "submissions", page] as const,
  submission: (sequence: string) => [...storageKeys.all, "submission", sequence] as const,
  address: (address: string, page: number) => [...storageKeys.all, "address", address, page] as const,
}
```

同步成功后只失效受影响的 summary/list/address keys。

- [ ] **Step 5: 运行测试**

Run: `pnpm test src/data && pnpm typecheck`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/data src/app/query-client.ts
git commit -m "feat: expose storage data source"
```

## Task 9: 建立 Light Theme、应用 Providers 和共享状态组件

**Files:**

- Modify: `src/styles/index.css`
- Create: `src/app/providers.tsx`
- Modify: `src/app/app.tsx`
- Create: `src/wallet/chains.ts`
- Create: `src/wallet/config.ts`
- Create: `src/wallet/config.test.ts`
- Create: `src/components/data-state.tsx`
- Create: `src/components/metric-card.tsx`
- Create: `src/components/sync-status.tsx`
- Create: `src/components/copy-button.tsx`
- Create: `src/components/pagination.tsx`
- Create: `src/components/components.test.tsx`
- Create: `src/test/render.tsx`

- [ ] **Step 1: 加载 UI 相关 Skills**

实施者必须加载：

- `design-conflux-storage-ui`
- `integrate-rainbowkit-wallets`
- `frontend-skill`
- `vercel-react-best-practices`

页面完成后使用 `web-design-guidelines` 做检查。

- [ ] **Step 2: 写共享组件失败测试**

断言：

- stale 状态显示最后同步时间和重试按钮；
- partial 状态显示“数据可能不完整”；
- incompatible contract 不提供继续解码按钮；
- pagination 产生可访问的上一页/下一页链接；
- copy button 有可读 label；
- DOM 中不存在 theme toggle。

钱包配置测试同时断言：

- eSpace 测试网 chain ID 为 71；
- RPC 来自配置，不来自 `window.ethereum`；
- `multiInjectedProviderDiscovery` 未被关闭；
- 无 WalletConnect project ID 时不创建 WalletConnect connector；
- 多个 EIP-6963 provider 不折叠成一个 Browser Wallet；
- 配置中不存在 write contract helper。

- [ ] **Step 3: 运行并确认失败**

Run: `pnpm test src/components/components.test.tsx src/wallet/config.test.ts`

Expected: FAIL，共享组件不存在。

- [ ] **Step 4: 写精确 Light Theme tokens**

```css
@import "tailwindcss";

:root {
  color-scheme: light;
  --color-primary: #17b38a;
  --color-primary-soft: #afe9d2;
  --color-primary-strong: #05343f;
  --color-link: #1e3de4;
  --color-link-hover: #0f23bd;
  --color-interactive: #4665f0;
  --color-accent-muted: #7789d3;
  --color-warning: #f8963e;
  --color-surface: #ffffff;
  --color-surface-raised: #fdfdfe;
  --color-canvas: #f0f4f3;
  --color-surface-subtle: #f1f3f9;
  --color-surface-blue: #f5f7ff;
  --color-border: #ebeced;
  --color-text-strong: #0f1327;
  --color-heading: #26244b;
  --color-text: #424a71;
  --color-text-muted: #65709a;
}
```

同时定义 focus ring、最大内容宽度、响应式 gutters、表格密度、skeleton animation，
并支持 `prefers-reduced-motion`。

- [ ] **Step 5: 实现钱包配置、Providers 和状态组件**

链定义：

```ts
export const confluxESpaceTestnet = defineChain({
  id: 71,
  name: "Conflux eSpace Testnet",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: "ConfluxScan", url: "https://evmtestnet.confluxscan.org" },
  },
  testnet: true,
})
```

`createConfig` 保持 `multiInjectedProviderDiscovery: true`。只在
`VITE_WALLETCONNECT_PROJECT_ID` 非空时加入 WalletConnect。

Provider 顺序：

```tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <RainbowKitProvider>
      <StorageDataSourceProvider value={dataSource}>{children}</StorageDataSourceProvider>
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

公开数据源始终使用配置的 viem public client，不能从 wagmi connector 获取 transport。

- [ ] **Step 6: 运行测试和键盘检查**

Run: `pnpm test src/components src/wallet && pnpm lint && pnpm typecheck`

Expected: PASS，无 Biome a11y 错误。

- [ ] **Step 7: 提交**

```bash
git add src/styles src/app src/components src/wallet
git commit -m "feat: add Conflux light design foundation"
```

## Task 10: 实现路由、全局搜索和应用 Header

**Files:**

- Create: `src/routes/__root.tsx`
- Create: `src/routes/index.tsx`
- Create: `src/routes/submissions.tsx`
- Create: `src/routes/submission.$sequence.tsx`
- Create: `src/routes/address.$address.tsx`
- Create: `src/components/app-header.tsx`
- Create: `src/features/search/global-search.tsx`
- Create: `src/features/search/global-search.test.tsx`
- Modify: `src/app/app.tsx`

- [ ] **Step 1: 写搜索失败测试**

```tsx
it.each([
  ["484", "/submission/484"],
  ["0xe9B0afd0DccB44Bc6e0a49f8032Cc7815A221ebE", "/address/0xe9B0afd0DccB44Bc6e0a49f8032Cc7815A221ebE"],
])("routes %s to %s", async (value, expected) => {
  const user = userEvent.setup()
  renderSearch()
  await user.type(screen.getByRole("searchbox"), value)
  await user.keyboard("{Enter}")
  expect(router.state.location.pathname).toBe(expected)
})
```

另断言交易哈希、负数、浮点数和短地址只显示本地错误，data source 未调用。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm test src/features/search/global-search.test.tsx`

Expected: FAIL，搜索组件不存在。

- [ ] **Step 3: 实现 file-based routes**

支持且仅支持：

```text
/
/submissions?page=<positive integer>
/submission/:sequence
/address/:address?page=<positive integer>
```

route loader/search validator 在进入页面前规范化 page、sequence 和 address。
404 页面保留搜索和返回首页操作。`/history` 由 Task 13 在钱包历史页面可用时一并加入。

- [ ] **Step 4: 实现 Header**

Header 包含：

- Conflux Storage Scan 品牌；
- Files 导航（首页、Submissions）；
- 全局搜索；
- “eSpace Testnet”网络标记；
- RainbowKit connect button。

不得出现 Mining、Rewards、Upload、Download 或主题切换。

- [ ] **Step 5: 运行路由测试**

Run: `pnpm test src/features/search && pnpm typecheck`

Expected: PASS，TanStack Router 生成 `src/routeTree.gen.ts`。

- [ ] **Step 6: 提交**

```bash
git add src/routes src/features/search src/components/app-header.tsx src/app src/routeTree.gen.ts
git commit -m "feat: add explorer routes and search"
```

## Task 11: 实现 Dashboard 和提交列表

**Files:**

- Create: `src/features/dashboard/dashboard-page.tsx`
- Create: `src/features/dashboard/dashboard-page.test.tsx`
- Create: `src/features/submissions/submissions-page.tsx`
- Create: `src/features/submissions/submissions-page.test.tsx`
- Create: `src/components/submission-table.tsx`
- Create: `src/components/address-link.tsx`

- [ ] **Step 1: 写页面失败测试**

Dashboard 断言：

- 合约提交数和已索引数分别展示；
- 逻辑数据量和已分配存储量不混淆；
- 费用精确显示 `0 CFX`；
- 显示五条最近提交；
- 数量不一致时显示 partial warning。

列表断言桌面列为 sequence、submitter、transaction、logical size、sectors、fee、age，
且不存在 download 列。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm test src/features/dashboard src/features/submissions`

Expected: FAIL，页面尚不存在。

- [ ] **Step 3: 实现格式化函数和 SubmissionTable**

字节数采用 IEC 单位，保留原始值 tooltip；地址和哈希中间截断但复制完整值；
时间使用 `<time dateTime>`；交易链接为：

```ts
export function confluxScanTransactionUrl(hash: `0x${string}`) {
  return `https://evmtestnet.confluxscan.org/tx/${hash}`
}
```

外链添加 `target="_blank"` 和 `rel="noopener noreferrer"`。

- [ ] **Step 4: 实现 Dashboard 和列表**

Dashboard 只请求 summary 和 page 1。Submissions 页通过 URL page 参数请求 20 条，
缓存旧页时使用 placeholder data，后台刷新时保留表格并显示 refresh 状态。

- [ ] **Step 5: 运行页面测试**

Run: `pnpm test src/features/dashboard src/features/submissions src/components && pnpm typecheck`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/dashboard src/features/submissions src/components
git commit -m "feat: add storage dashboard and submissions"
```

## Task 12: 实现提交详情和地址详情

**Files:**

- Create: `src/features/submission-detail/submission-detail-page.tsx`
- Create: `src/features/submission-detail/submission-detail-page.test.tsx`
- Create: `src/features/address/address-page.tsx`
- Create: `src/features/address/address-page.test.tsx`

- [ ] **Step 1: 写详情失败测试**

提交详情断言：

- 标签为“提交标识/数据根”，不是“文件哈希”；
- 状态为“已在 eSpace 索引”；
- 展示 start、end exclusive、sector count、node count、tags；
- 展示 block、tx、timestamp、contract、implementation；
- storage fee 为 `0 CFX`；
- 无 gas fee、gas used 和 download。

地址详情断言：

- checksum 地址和复制按钮；
- 提交总数和逻辑字节总量；
- 按 event submitter 过滤，而不是 transaction sender；
- URL 分页稳定。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm test src/features/submission-detail src/features/address`

Expected: FAIL。

- [ ] **Step 3: 实现详情页面**

不存在 sequence 时显示明确空状态，RPC 故障但缓存有记录时显示 stale record。
可选 `getFlowRootByTxSeq` 失败不能阻塞事件字段。

- [ ] **Step 4: 实现地址页面**

使用 viem `getAddress()` 规范化输入。非法地址由 route error component 处理，
不发 RPC。分页表格复用 `SubmissionTable`。

- [ ] **Step 5: 运行测试**

Run: `pnpm test src/features/submission-detail src/features/address && pnpm lint`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/submission-detail src/features/address
git commit -m "feat: add submission and address details"
```

## Task 13: 实现 My Submissions 钱包历史

**Files:**

- Create: `src/features/wallet-history/wallet-history-page.tsx`
- Create: `src/features/wallet-history/wallet-history-page.test.tsx`
- Create: `src/routes/history.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/components/app-header.tsx`

- [ ] **Step 1: 加载钱包 Skill**

实施者必须加载 `integrate-rainbowkit-wallets` 和 `vercel-react-best-practices`。

- [ ] **Step 2: 写钱包历史失败测试**

断言未连接、连接到链 71、连接到其他链、切换账户四种状态。模拟两个 EIP-6963 provider，
确认 ConnectButton 能分别展示它们。

- [ ] **Step 3: 运行并确认失败**

Run: `pnpm test src/features/wallet-history/wallet-history-page.test.tsx`

Expected: FAIL，钱包历史页面不存在。

- [ ] **Step 4: 实现 `/history`**

状态：

- 未连接：连接钱包空状态；
- 已连接 ID 71：按当前 account 查询；
- 已连接其他链：仍展示公开 client 的 Conflux 数据，同时提供 `switchChain({ chainId: 71 })`；
- account 变化：query key 变化并取消旧请求。

页面文案为“My Submissions / 我的提交”，不能写“My Files”。
同时在 Header 增加 My Submissions 导航。

- [ ] **Step 5: 运行钱包和页面测试**

Run: `pnpm test src/wallet src/features/wallet-history && pnpm typecheck`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/wallet-history src/routes/history.tsx src/components/app-header.tsx src/app/providers.tsx
git commit -m "feat: add read-only RainbowKit wallet flows"
```

## Task 14: 完成缓存故障、恢复操作和用户可见状态

**Files:**

- Modify: `src/components/data-state.tsx`
- Modify: `src/data/live-rpc-data-source.ts`
- Create: `src/features/recovery/rebuild-index-button.tsx`
- Create: `src/features/recovery/recovery.test.tsx`
- Modify: `tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1/faults/*.json`

- [ ] **Step 1: 写恢复失败测试**

断言：

- transient RPC error + cache：保留内容，显示 stale 和最后成功时间；
- transient RPC error + 无缓存：显示 retry；
- corrupt cache：显示“重建本地索引”；
- rebuild 需要二次确认；
- rebuild 只清理当前应用 namespace；
- implementation changed：显示阻断说明，不提供绕过；
- wrong chain：显示预期 71 和实际值；
- sequence gap：显示 partial，不显示“同步完成”。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm test src/features/recovery/recovery.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现恢复状态**

将 typed data errors 映射到唯一用户状态。Retry 只重新执行失败 query/sync。
Rebuild 调用 `dataSource.rebuildLocalIndex()` 后重新同步。按钮确认文案明确将删除
“本浏览器中的 Conflux Storage Scan 本地索引”，不声称删除链上数据。

- [ ] **Step 4: 运行故障套件**

Run:

```bash
pnpm test src/features/recovery src/chain/sync src/data
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/components/data-state.tsx src/data src/features/recovery tests/fixtures
git commit -m "feat: add explorer failure recovery"
```

## Task 15: 添加 Playwright 端到端测试和移动端验证

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/explorer.spec.ts`
- Create: `tests/e2e/wallet.spec.ts`
- Create: `tests/e2e/mobile.spec.ts`
- Create: `src/test/handlers.ts`
- Create: `src/test/server.ts`

- [ ] **Step 1: 写 fixture-backed E2E 测试**

覆盖：

```text
dashboard -> submissions
search sequence -> submission detail
search address -> address detail
submission pagination survives reload
external tx link points to ConfluxScan
disconnected /history
mocked EIP-6963 two-wallet discovery
stale cache + successful refresh
RPC failure + cached fallback
mobile header, search, table detail access
```

测试模式通过环境变量启用 `FixtureDataSource`，不得访问 live RPC。

- [ ] **Step 2: 运行并确认至少一个测试失败**

Run: `pnpm exec playwright install chromium && pnpm test:e2e`

Expected: FAIL，fixture test bootstrapping 尚未接入。

- [ ] **Step 3: 接入测试数据源**

仅当 `import.meta.env.MODE === "test"` 且 `VITE_DATA_SOURCE=fixture` 时创建
`FixtureDataSource`。生产 build 不暴露用于改写数据的测试控制接口。

- [ ] **Step 4: 运行 E2E**

Run: `pnpm test:e2e`

Expected: 所有 Chromium desktop 和 mobile 项目 PASS。

- [ ] **Step 5: 浏览器人工检查**

使用真实浏览器检查：

- 1440px、1024px、390px 三种宽度；
- Header、搜索、指标卡、表格和详情；
- 键盘 Tab 顺序和 focus ring；
- 无水平页面溢出；
- Light Theme 无主题切换；
- 无 Mining、Rewards、Upload、Download；
- 空、loading、stale、partial、blocking error 状态。

发现问题先写回归测试，再修复。

- [ ] **Step 6: 提交**

```bash
git add playwright.config.ts tests/e2e src/test
git commit -m "test: cover storage explorer browser flows"
```

## Task 16: 最终本地门禁、只读 live probe 和交付审计

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-28-conflux-storage-scan-mvp.md`

- [ ] **Step 1: 编写 README**

README 必须包含：

- 产品范围和明确 non-goals；
- Node/pnpm 要求；
- 安装和启动命令；
- `VITE_CONFLUX_ESPACE_RPC_URL`；
- 可选 `VITE_WALLETCONNECT_PROJECT_ID`；
- fixtures 和自动 capture 安全语义；
- 本地验证命令；
- FixedPriceFlow proxy/beacon/implementation 地址；
- 当前无 CI 的说明。

- [ ] **Step 2: 执行完整 deterministic gate**

Run:

```bash
pnpm harness:validate
pnpm verify
pnpm test:e2e
```

Expected: 三条命令退出码均为 0。

- [ ] **Step 3: 执行只读 live probe**

Run:

```bash
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com pnpm harness:probe
```

Expected:

```text
chain=71 proxy=ok beacon=ok implementation=ok submissions=<live value> logs=<live value> paused=false
```

如果 implementation 已变化，不能更新期望地址后直接继续；必须执行设计文档第 11 节的
源码、ABI、fixture 和回归验证流程。

- [ ] **Step 4: 运行范围审计**

Run:

```bash
rg -n -i "mining|reward|download|upload|pricePerSector|sendTransaction|writeContract" src
rg -n "#17b38a|#afe9d2|#05343f|#1e3de4|#0f23bd|#4665f0|#7789d3|#f8963e" src/styles/index.css
git status --short
```

Expected:

- 第一条只允许出现在明确的禁止性测试或错误说明中；
- 所有关键 Conflux 色值存在；
- 工作区只包含本任务明确接受的文件。

- [ ] **Step 5: 更新计划 checkbox 和 Token 记录**

将实际完成步骤改为 `[x]`。读取项目 Token tracker，记录：

- 计划完成时累计 Token；
- Harness 完成时累计 Token；
- 链数据完成时累计 Token；
- UI/钱包完成时累计 Token；
- 最终验证完成时累计 Token。

Token 数只报告内置 tracker 的真实值，不使用字符数推算。

- [ ] **Step 6: 请求代码评审**

加载 `superpowers:requesting-code-review`，按设计 Spec 和本计划做 requirement-by-requirement
审查。发现问题时先写/补回归测试再修复。

- [ ] **Step 7: 最终提交**

```bash
git add README.md docs/superpowers/plans/2026-07-28-conflux-storage-scan-mvp.md
git commit -m "docs: finalize storage scan delivery"
```

## 2. 计划覆盖矩阵

| Spec 要求 | 实施任务 |
| --- | --- |
| Vite React SPA、pnpm、Conflux 代码规范 | Task 1 |
| 根 AGENTS.md 和三个专项 Skills | Task 2 |
| FixedPriceFlow ABI 与 Beacon 严格模式 | Task 3 |
| Submit 语义、identity、大小和扇区 | Task 4 |
| 自动 fixture 写入、不可覆盖、无自动 Git | Task 5 |
| IndexedDB、checkpoint、链重组 | Task 6–7 |
| `StorageDataSource` 可替换边界 | Task 8 |
| Light Theme 和精确 Conflux 色值 | Task 9 |
| 0G 参考路由和全局搜索 | Task 10 |
| Dashboard 和 submissions | Task 11 |
| submission/address detail | Task 12 |
| RainbowKit、wagmi、EIP-6963、`/history` | Task 13 |
| stale/partial/error/corrupt cache 恢复 | Task 14 |
| fixture-backed 浏览器和移动端测试 | Task 15 |
| 无挖矿/奖励/上传/下载、费用恒为 0 | Task 3、4、9–16 |
| 无 CI、完整本地门禁、live probe | Task 1、5、16 |

## 3. 实施顺序和 checkpoint

必须按依赖顺序执行：

1. Task 1–2：工程基线和 Agent Harness；
2. Task 3–5：合约、标准化和 live fixture；
3. Task 6–8：持久化、同步和数据源；
4. Task 9–12：设计基础和公开路由；
5. Task 13–14：钱包和故障恢复；
6. Task 15–16：端到端验证和交付。

每个 checkpoint 都要保持 `pnpm verify` 可通过。不得把失败测试跨 checkpoint 留在主分支。

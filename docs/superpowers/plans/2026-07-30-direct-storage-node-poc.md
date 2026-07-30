# Direct Storage Node POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branch-only `/storage` POC that prepares one browser file, submits it to the pinned Conflux FixedPriceFlow contract with zero storage value, uploads proved segments directly to a healthy hardcoded Storage Node, downloads them again, and verifies integrity.

**Architecture:** Keep the existing explorer `StorageDataSource` read-only. Add a separate storage POC domain with an upstream SDK computation adapter, a typed JSON-RPC node client, a health-selecting node pool, a viem contract writer, an IndexedDB session store, and an injected runtime consumed by one React route. Deterministic tests inject fake clients; only the explicit live probe reads real nodes, and only a user-confirmed browser action sends a real transaction.

**Tech Stack:** Vite 8, React 19, strict TypeScript, TanStack Router/Query, RainbowKit, wagmi 2, viem, IndexedDB/idb, Vitest, Testing Library, Playwright, `@0gfoundation/0g-storage-ts-sdk@1.2.10`, `ethers@6.13.1`, `vite-plugin-node-polyfills@0.28.0`.

---

## Execution constraints

- Work only on `codex/direct-storage-node-poc`; do not use worktrees and do not merge `master`.
- Use all three project skills because the change crosses chain/RPC, wallet, and UI boundaries.
- Follow RED/GREEN/REFACTOR for every behavior task.
- Never call upstream `Indexer.upload()` or `Uploader.uploadFile()`.
- Never call `pricePerSector`; submit with `value: 0n`.
- Never place a private key, automated signer, or real write into tests or Harness scripts.
- Treat the upstream npm tarball integrity
  `sha512-Ry2VXsFAZMSQMkv0hX6QPA9CyF+Eed2z3BNHggaQDi/pZTc9WP55MzGVTGiqxbNhCMwyJRrhTRJBY0ZAGgkkAw==`
  as part of the computation fixture provenance.

## Locked source layout

```text
src/storage/
  config.ts                         POC constants and fixed node endpoints
  types.ts                          normalized storage POC domain types/errors
  sdk/prepare-file.ts               upstream SDK adapter and segment builder
  sdk/prepare-file.test.ts
  sdk/fixtures.ts                   deterministic boundary roots/provenance
  node/storage-node-client.ts       typed JSON-RPC transport
  node/storage-node-client.test.ts
  node/node-pool.ts                 health checks and candidate selection
  node/node-pool.test.ts
  contract/submit-storage.ts        core deployment verification + viem submit
  contract/submit-storage.test.ts
  upload/upload-segments.ts         bounded concurrent idempotent upload
  upload/upload-segments.test.ts
  upload/wait-for-node.ts           bounded node synchronization polling
  upload/wait-for-node.test.ts
  session/storage-session-store.ts  IndexedDB metadata-only persistence
  session/storage-session-store.test.ts
  session/upload-session.ts         pure state machine/reducer
  session/upload-session.test.ts
  download/download-file.ts         bounded download and Root verification
  download/download-file.test.ts
  runtime.ts                        injectable composition root
  runtime.test.ts
  runtime-fixture.ts                deterministic browser/e2e runtime

src/features/storage-poc/
  storage-page.tsx
  storage-page.test.tsx
  node-health-panel.tsx
  upload-panel.tsx
  download-panel.tsx
  use-storage-poc.ts

src/routes/storage.tsx
src/test/render.test.tsx
scripts/harness/storage-node-probe.ts
tests/e2e/storage-poc.spec.ts
```

## Task 1: Scope the branch Harness for the POC

**Files:**
- Modify: `AGENTS.md`
- Modify: `.agents/skills/develop-conflux-storage-data/SKILL.md`
- Modify: `.agents/skills/integrate-rainbowkit-wallets/SKILL.md`
- Modify: `.agents/skills/design-conflux-storage-ui/SKILL.md`
- Modify: `scripts/validate-agent-harness.mjs`

- [ ] **Step 1: Make Harness validation require a branch-only POC rule**

Add the following required strings to `scripts/validate-agent-harness.mjs`:

```js
[
	"AGENTS.md",
	[
		"branch-only Storage Node POC",
		"codex/direct-storage-node-poc",
		"Never call `pricePerSector`",
		"Never merge this POC into `master`",
	],
],
```

Require `direct Storage Node`, `value: 0n`, and `user-confirmed` in the data and wallet skills, and require
`/storage`, `Local HTTP POC`, and `100 MiB` in the UI skill.

- [ ] **Step 2: Run Harness validation and observe RED**

Run:

```bash
corepack pnpm harness:validate
```

Expected: FAIL because the existing project instructions still define a strictly read-only product.

- [ ] **Step 3: Add a narrowly scoped POC exception**

Add this branch-specific rule to `AGENTS.md` without removing the `master` invariants:

```markdown
## Branch-only Storage Node POC

- Only on `codex/direct-storage-node-poc`, `/storage` may request a user-confirmed
  FixedPriceFlow `submit` transaction and direct Storage Node upload/download.
- Keep explorer routes and `StorageDataSource` read-only.
- Submit only to chain `71` and the pinned proxy with `value: 0n`.
- Never call `pricePerSector`, infer storage price, or use the upstream high-level uploader.
- Never put a signer or real write into deterministic tests or Harness scripts.
- Never merge this POC into `master` without a separate product/security review.
```

Add matching scoped exceptions to the three project skills. Keep all existing chain identity, Light Theme,
EIP-6963, fixture, and accessibility rules.

- [ ] **Step 4: Run Harness validation and observe GREEN**

Run:

```bash
corepack pnpm harness:validate
```

Expected: `Validated 5 agent harness files`.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md .agents/skills scripts/validate-agent-harness.mjs
git commit -m "docs: scope branch-only storage node poc"
```

## Task 2: Pin the upstream browser computation dependency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vite.config.ts`
- Create: `src/storage/sdk/sdk-browser.test.ts`

- [ ] **Step 1: Write the failing browser SDK smoke test**

```ts
import { Blob as ZgBlob } from "@0gfoundation/0g-storage-ts-sdk/browser"
import { describe, expect, it } from "vitest"

describe("0G browser SDK", () => {
	it("builds a Merkle root from a browser File", async () => {
		const file = new File([Uint8Array.of(0)], "one-byte.bin")
		const [tree, error] = await new ZgBlob(file).merkleTree()

		expect(error).toBeNull()
		expect(tree?.rootHash()).toBe(
			"0xd397b3b043d87fcd6fad1291ff0bfd16401c274896d8c63a923727f077b8e0b5",
		)
	})
})
```

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
corepack pnpm test src/storage/sdk/sdk-browser.test.ts
```

Expected: FAIL because the package is not installed.

- [ ] **Step 3: Install exact versions**

```bash
corepack pnpm add @0gfoundation/0g-storage-ts-sdk@1.2.10 ethers@6.13.1
corepack pnpm add -D vite-plugin-node-polyfills@0.28.0
```

Update `vite.config.ts`:

```ts
import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "react" }),
		nodePolyfills({
			include: ["buffer", "crypto", "events", "stream", "util"],
		}),
		tailwindcss(),
		react(),
	],
})
```

- [ ] **Step 4: Prove the browser import and build**

Run:

```bash
corepack pnpm test src/storage/sdk/sdk-browser.test.ts
corepack pnpm build
```

Expected: PASS and a successful Vite production build.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts src/storage/sdk/sdk-browser.test.ts
git commit -m "build: add pinned storage browser sdk"
```

## Task 3: Define POC constants, normalized types, and Node JSON-RPC transport

**Files:**
- Create: `src/storage/config.ts`
- Create: `src/storage/types.ts`
- Create: `src/storage/node/storage-node-client.ts`
- Create: `src/storage/node/storage-node-client.test.ts`

- [ ] **Step 1: Write transport tests**

The test must inject a fake `fetch` and assert exact JSON-RPC method/params for status, shard, FileInfo,
upload, and download:

```ts
it("sends zgs_getFileInfoByTxSeq with a safe numeric sequence", async () => {
	const requests: unknown[] = []
	const client = new HttpStorageNodeClient(NODE_URL, {
		fetch: async (_input, init) => {
			requests.push(JSON.parse(String(init?.body)))
			return Response.json({ jsonrpc: "2.0", id: 1, result: null })
		},
	})

	await client.getFileInfoByTxSeq(485)

	expect(requests).toEqual([
		{ jsonrpc: "2.0", id: 1, method: "zgs_getFileInfoByTxSeq", params: [485] },
	])
})
```

Also assert that a JSON-RPC `error`, malformed result, HTTP error, and timeout become typed
`StoragePocError` values without exposing response bodies.

- [ ] **Step 2: Run the transport test and observe RED**

```bash
corepack pnpm test src/storage/node/storage-node-client.test.ts
```

Expected: FAIL because the client and types do not exist.

- [ ] **Step 3: Add constants and types**

`src/storage/config.ts`:

```ts
export const STORAGE_CHUNK_BYTES = 256
export const STORAGE_SEGMENT_CHUNKS = 1024
export const STORAGE_SEGMENT_BYTES = STORAGE_CHUNK_BYTES * STORAGE_SEGMENT_CHUNKS
export const STORAGE_POC_MAX_FILE_BYTES = 100 * 1024 * 1024
export const STORAGE_NODE_TIMEOUT_MS = 5_000
export const STORAGE_NODE_SYNC_TIMEOUT_MS = 5 * 60_000
export const STORAGE_NODE_POLL_INTERVAL_MS = 1_000
export const STORAGE_NODE_MAX_BLOCK_LAG = 512n
export const STORAGE_UPLOAD_CONCURRENCY = 2
export const STORAGE_UPLOAD_MAX_ATTEMPTS = 3

export const CONFLUX_STORAGE_NODE_URLS = [
	"http://47.84.225.228:5678",
	"http://47.84.224.253:5678",
] as const
```

`src/storage/types.ts` must define validated forms of:

```ts
export interface StorageNodeStatus {
	readonly connectedPeers: number
	readonly logSyncHeight: bigint
	readonly nextTxSeq: number
	readonly networkIdentity: {
		readonly chainId: number
		readonly flowAddress: Address
	}
}

export interface StorageNodeFileInfo {
	readonly tx: {
		readonly dataMerkleRoot: Hex
		readonly startEntryIndex: bigint
		readonly size: number
		readonly seq: number
	}
	readonly finalized: boolean
	readonly uploadedSegNum: number
}

export interface StorageSegmentWithProof {
	readonly root: Hex
	readonly data: string
	readonly index: number
	readonly proof: { readonly lemma: readonly Hex[]; readonly path: readonly boolean[] }
	readonly fileSize: number
}
```

All wire values must be parsed before entering these types. Reject unsafe integers and invalid hashes/addresses.

- [ ] **Step 4: Implement the injected transport**

Expose:

```ts
export interface StorageNodeClient {
	readonly url: string
	getStatus(): Promise<StorageNodeStatus>
	getShardConfig(): Promise<StorageShardConfig>
	getFileInfo(root: Hex, needAvailable: boolean): Promise<StorageNodeFileInfo | null>
	getFileInfoByTxSeq(txSeq: number): Promise<StorageNodeFileInfo | null>
	uploadSegmentsByTxSeq(segments: readonly StorageSegmentWithProof[], txSeq: number): Promise<number>
	downloadSegmentByTxSeq(txSeq: number, startChunk: number, endChunk: number): Promise<string>
}
```

Use an incrementing numeric JSON-RPC id, `Content-Type: application/json`, and a bounded `AbortController`.

- [ ] **Step 5: Run focused tests**

```bash
corepack pnpm test src/storage/node/storage-node-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/config.ts src/storage/types.ts src/storage/node
git commit -m "feat: add typed storage node rpc client"
```

## Task 4: Select one healthy synchronized full node

**Files:**
- Create: `src/storage/node/node-pool.ts`
- Create: `src/storage/node/node-pool.test.ts`

- [ ] **Step 1: Write node selection tests**

Cover identity rejection, 512-block lag rejection, `{0,1}` shard enforcement, TxSeq visibility, timeout,
and best-height selection:

```ts
it("selects the highest synchronized complete node", async () => {
	const selected = await selectStorageNode({
		chainHead: 258_467_910n,
		clients: [
			fakeNode({ logSyncHeight: 258_316_358n, nextTxSeq: 484 }),
			fakeNode({ logSyncHeight: 258_467_864n, nextTxSeq: 486 }),
		],
		requiredTxSeq: 485,
	})

	expect(selected.client.url).toBe("http://47.84.224.253:5678")
	expect(selected.blockLag).toBe(46n)
})
```

- [ ] **Step 2: Run the test and observe RED**

```bash
corepack pnpm test src/storage/node/node-pool.test.ts
```

Expected: FAIL because `selectStorageNode` is absent.

- [ ] **Step 3: Implement health evaluation and selection**

Expose:

```ts
export interface StorageNodeHealth {
	readonly client: StorageNodeClient
	readonly status: StorageNodeStatus
	readonly shard: StorageShardConfig
	readonly blockLag: bigint
	readonly latencyMs: number
	readonly healthy: boolean
	readonly reason?: StorageNodeHealthReason
}

export async function inspectStorageNodes(input: {
	readonly chainHead: bigint
	readonly clients: readonly StorageNodeClient[]
	readonly requiredTxSeq?: number
}): Promise<readonly StorageNodeHealth[]>

export interface SelectStorageNodeInput {
	readonly chainHead: bigint
	readonly clients: readonly StorageNodeClient[]
	readonly requiredTxSeq?: number
}

export async function selectStorageNode(input: SelectStorageNodeInput): Promise<StorageNodeHealth>
```

A healthy POC node must report chain `71`, the pinned Flow address, shard `{0,1}`, lag `<= 512`, and
`nextTxSeq > requiredTxSeq` when a TxSeq is provided. Sort healthy nodes by log height descending and latency
ascending.

- [ ] **Step 4: Run focused tests**

```bash
corepack pnpm test src/storage/node/node-pool.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/node/node-pool.ts src/storage/node/node-pool.test.ts
git commit -m "feat: select healthy conflux storage nodes"
```

## Task 5: Prepare files and lock upstream Merkle fixtures

**Files:**
- Create: `src/storage/sdk/fixtures.ts`
- Create: `src/storage/sdk/prepare-file.ts`
- Create: `src/storage/sdk/prepare-file.test.ts`

- [ ] **Step 1: Add deterministic fixture expectations**

Generate file bytes with `byte[i] = i % 251` and lock:

```ts
export const storageSdkFixtureRoots = {
	1: "0xd397b3b043d87fcd6fad1291ff0bfd16401c274896d8c63a923727f077b8e0b5",
	255: "0x037a0c9cbd377fa4d88832b1adb2de77b7a2939815debfc83137ecf1b89bf984",
	256: "0xe2a94a8afb5941b26a9be1be979c403e33559570b52961b48b3f7d36237fecc8",
	257: "0x24b74d6cdc150cad90a1ba71ff747a7e0d377f676fc78dbcc9218d22dafa503b",
	262143: "0xf8f1aae97b95c26ee1d7b2190ac539b7f708c150b75d8f31f701ad1e1514b65a",
	262144: "0x4d533607c0f4423a9287d761e7394aa61552adb7d6a080cdb278ddb65b2eacb7",
	262145: "0x1458412a6ece9f4f9dc83ade0c68037378ef3e10fe484cea5d451cc10c9212d0",
} as const
```

Record package `1.2.10`, source commit, and npm integrity in the same fixture module.

- [ ] **Step 2: Write preparation and Segment tests**

Tests must assert:

- empty and `100 MiB + 1` files are rejected before hashing;
- boundary roots above match exactly;
- `tags` is `0x`;
- submitter is normalized;
- `262145 B` produces two padded Segments;
- the last Segment keeps its final 256-byte Chunk padding but removes unused whole Chunks before Base64 encoding;
- each generated proof validates against the file Root.

- [ ] **Step 3: Run the test and observe RED**

```bash
corepack pnpm test src/storage/sdk/prepare-file.test.ts
```

Expected: FAIL because the adapter is absent.

- [ ] **Step 4: Implement the SDK adapter**

Expose:

```ts
export interface PreparedStorageFile {
	readonly source: File
	readonly sdkFile: ZgBlob
	readonly tree: MerkleTree
	readonly root: Hex
	readonly identity: Hex
	readonly submission: {
		readonly data: {
			readonly length: bigint
			readonly tags: "0x"
			readonly nodes: readonly { readonly root: Hex; readonly height: bigint }[]
		}
		readonly submitter: Address
	}
	readonly chunkCount: number
	readonly segmentCount: number
}

export async function prepareStorageFile(file: File, submitter: Address): Promise<PreparedStorageFile>
export async function createStorageSegment(
	prepared: PreparedStorageFile,
	segmentIndex: number,
): Promise<StorageSegmentWithProof>
```

Normalize all upstream SDK outputs at this boundary. Calculate identity with the existing
`calculateSubmissionIdentity`. Implement Base64 conversion locally; do not instantiate upstream `Uploader`.

- [ ] **Step 5: Run focused tests**

```bash
corepack pnpm test src/storage/sdk/prepare-file.test.ts
```

Expected: PASS for every locked boundary Root.

- [ ] **Step 6: Commit**

```bash
git add src/storage/sdk
git commit -m "feat: prepare storage files with locked merkle fixtures"
```

## Task 6: Add core deployment verification and zero-value submit

**Files:**
- Modify: `src/chain/proxy/verify-deployment.ts`
- Modify: `src/chain/proxy/verify-deployment.test.ts`
- Create: `src/storage/contract/submit-storage.ts`
- Create: `src/storage/contract/submit-storage.test.ts`

- [ ] **Step 1: Write tests for verification without Market reads**

Add `verifyCoreDeployment(client)` tests that assert chain, proxy code, Beacon, Beacon code, and Implementation
are verified while `market()` is never called. Preserve existing `verifyDeployment` behavior for the read-only
explorer.

- [ ] **Step 2: Write submit tests**

Use fake viem clients and assert:

```ts
expect(walletClient.writeContract).toHaveBeenCalledWith(
	expect.objectContaining({
		address: FIXED_PRICE_FLOW_PROXY,
		functionName: "submit",
		value: 0n,
	}),
)
expect(publicClient.readContract).not.toHaveBeenCalledWith(
	expect.objectContaining({ functionName: "pricePerSector" }),
)
```

Also cover user rejection, reverted receipt, no matching Submit event, and matching by prepared identity.

- [ ] **Step 3: Run both tests and observe RED**

```bash
corepack pnpm test src/chain/proxy/verify-deployment.test.ts src/storage/contract/submit-storage.test.ts
```

Expected: FAIL because the core verifier and submit module are absent.

- [ ] **Step 4: Extract the core verifier**

Add:

```ts
export interface CoreDeploymentIdentity {
	readonly chainId: 71
	readonly proxy: Address
	readonly beacon: Address
	readonly implementation: Address
}

export async function verifyCoreDeployment(client: PublicClient): Promise<CoreDeploymentIdentity>
```

Make the existing `verifyDeployment` call `verifyCoreDeployment` and then perform its current Market address
verification.

- [ ] **Step 5: Implement the write-only ABI and submit helper**

Define a minimal payable `submit` ABI next to the helper and expose:

```ts
export async function submitStorageFile(input: {
	readonly prepared: PreparedStorageFile
	readonly account: Address
	readonly publicClient: PublicClient
	readonly walletClient: WalletClient
}): Promise<{ readonly txHash: Hex; readonly txSeq: number }>
```

Call `verifyCoreDeployment`, require wallet chain `71`, write with `value: 0n`, wait for a successful receipt,
parse strict `Submit` logs, and select the event whose `identity` equals `prepared.identity`.

- [ ] **Step 6: Run focused tests**

```bash
corepack pnpm test src/chain/proxy/verify-deployment.test.ts src/storage/contract/submit-storage.test.ts
```

Expected: PASS, with no Market pricing calls.

- [ ] **Step 7: Commit**

```bash
git add src/chain/proxy src/storage/contract
git commit -m "feat: submit zero-value storage commitments safely"
```

## Task 7: Wait for node sync and upload Segments idempotently

**Files:**
- Create: `src/storage/upload/wait-for-node.ts`
- Create: `src/storage/upload/wait-for-node.test.ts`
- Create: `src/storage/upload/upload-segments.ts`
- Create: `src/storage/upload/upload-segments.test.ts`

- [ ] **Step 1: Write bounded polling tests**

Use an injected clock:

```ts
const info = await waitForNodeFileInfo({
	client,
	expectedRoot,
	expectedSize: 257,
	pollIntervalMs: 1,
	timeoutMs: 5,
	sleep: async () => {},
	txSeq: 485,
})
```

Assert success after transient nulls, timeout without resubmission, Root mismatch rejection, and size mismatch
rejection.

- [ ] **Step 2: Write concurrent upload tests**

Assert concurrency never exceeds 2, every Segment is uploaded with the same TxSeq, retry delays increase,
already-uploaded errors succeed, non-retryable errors stop, and progress counts only confirmed Segments.

- [ ] **Step 3: Run tests and observe RED**

```bash
corepack pnpm test src/storage/upload
```

Expected: FAIL because the upload modules are absent.

- [ ] **Step 4: Implement bounded polling**

Expose:

```ts
export async function waitForNodeFileInfo(input: {
	readonly client: StorageNodeClient
	readonly txSeq: number
	readonly expectedRoot: Hex
	readonly expectedSize: number
	readonly timeoutMs?: number
	readonly pollIntervalMs?: number
	readonly sleep?: (ms: number) => Promise<void>
}): Promise<StorageNodeFileInfo>
```

Use elapsed deadline checks; never use an unbounded `while (true)`.

- [ ] **Step 5: Implement bounded concurrent upload**

Expose:

```ts
export async function uploadPreparedSegments(input: {
	readonly client: StorageNodeClient
	readonly prepared: PreparedStorageFile
	readonly txSeq: number
	readonly concurrency?: number
	readonly maxAttempts?: number
	readonly onProgress?: (progress: StorageUploadProgress) => void
	readonly sleep?: (ms: number) => Promise<void>
}): Promise<void>
```

Use a two-worker index queue. Build one Segment per task, call `uploadSegmentsByTxSeq([segment], txSeq)`, retry
only rate-limit/temporary-write errors at 500/1000/2000 ms, and surface typed errors.

- [ ] **Step 6: Run focused tests**

```bash
corepack pnpm test src/storage/upload
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/storage/upload
git commit -m "feat: upload storage segments with bounded retries"
```

## Task 8: Persist metadata-only upload sessions

**Files:**
- Create: `src/storage/session/storage-session-store.ts`
- Create: `src/storage/session/storage-session-store.test.ts`
- Create: `src/storage/session/upload-session.ts`
- Create: `src/storage/session/upload-session.test.ts`

- [ ] **Step 1: Write state machine tests**

Define legal transitions and assert that `transaction-pending -> waiting-node-sync -> uploading -> completed`
works, while `completed -> transaction-pending` and recovery-triggered resubmission are rejected.

- [ ] **Step 2: Write IndexedDB tests**

Using fake IndexedDB, assert serialized records contain Root, TxHash, TxSeq, selected node, confirmed Segment
indices, and timestamps, but never contain `File`, Blob bytes, signer, provider, or wallet objects.

- [ ] **Step 3: Run tests and observe RED**

```bash
corepack pnpm test src/storage/session
```

Expected: FAIL because the session modules are absent.

- [ ] **Step 4: Implement the pure reducer**

Use a discriminated union:

```ts
export type StorageUploadPhase =
	| "idle"
	| "preparing"
	| "ready"
	| "awaiting-wallet"
	| "transaction-pending"
	| "waiting-node-sync"
	| "uploading"
	| "verifying-node"
	| "downloading-for-verification"
	| "completed"
	| "paused"
	| "recoverable-error"
	| "blocked-error"
```

Reducer actions must carry explicit data. No boolean combinations such as `isUploading && hasError`.

- [ ] **Step 5: Implement the versioned store**

Use database `conflux-storage-poc-v1`, store `sessions`, and decimal strings for any bigint-shaped persisted
value. Expose `getLatest`, `put`, `delete`, and `clear`.

- [ ] **Step 6: Run focused tests**

```bash
corepack pnpm test src/storage/session
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/storage/session
git commit -m "feat: persist recoverable storage upload sessions"
```

## Task 9: Download and verify files from a full node

**Files:**
- Create: `src/storage/download/download-file.ts`
- Create: `src/storage/download/download-file.test.ts`

- [ ] **Step 1: Write download tests**

Cover TxSeq and Root lookup, 100 MiB preflight rejection, chunk ranges, final padding trim, missing Segment,
Root mismatch, and success:

```ts
expect(await downloadAndVerifyStorageFile({ client, target: { txSeq: 483 } })).toEqual(
	expect.objectContaining({
		root: expectedRoot,
		txSeq: 483,
		verified: true,
	}),
)
```

- [ ] **Step 2: Run the test and observe RED**

```bash
corepack pnpm test src/storage/download/download-file.test.ts
```

Expected: FAIL because the downloader is absent.

- [ ] **Step 3: Implement bounded download**

Expose:

```ts
export type StorageDownloadTarget =
	| { readonly txSeq: number }
	| { readonly root: Hex }

export async function downloadAndVerifyStorageFile(input: {
	readonly client: StorageNodeClient
	readonly target: StorageDownloadTarget
	readonly originalFile?: File
}): Promise<StorageDownloadResult>
```

Resolve FileInfo first, reject size over the cap, calculate chunk ranges of at most 1024, decode Base64,
trim the final result to `info.tx.size`, construct a browser File, call `prepareStorageFile` with a zero address
only for Root recomputation, and compare Root. If `originalFile` exists, compare bytes in bounded slices.

- [ ] **Step 4: Run focused tests**

```bash
corepack pnpm test src/storage/download/download-file.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/download
git commit -m "feat: download and verify storage node files"
```

## Task 10: Compose an injectable POC runtime

**Files:**
- Create: `src/storage/runtime.ts`
- Create: `src/storage/runtime.test.ts`
- Create: `src/storage/runtime-fixture.ts`
- Modify: `src/app/providers.tsx`
- Modify: `src/test/render.tsx`
- Create: `src/test/render.test.tsx`

- [ ] **Step 1: Write provider/runtime tests**

Assert components receive an injected fake runtime in tests and that fixture mode never constructs an HTTP client
for either hardcoded IP.

- [ ] **Step 2: Run tests and observe RED**

```bash
corepack pnpm test src/storage/runtime.test.ts src/test/render.test.tsx
```

Expected: FAIL because the context does not exist.

- [ ] **Step 3: Define the runtime interface**

```ts
export interface StoragePocRuntime {
	inspectNodes(chainHead: bigint, requiredTxSeq?: number): Promise<readonly StorageNodeHealth[]>
	selectNode(chainHead: bigint, requiredTxSeq?: number): Promise<StorageNodeHealth>
	prepareFile(file: File, submitter: Address): Promise<PreparedStorageFile>
	waitForFile(input: WaitForNodeFileInfoInput): Promise<StorageNodeFileInfo>
	upload(input: UploadPreparedSegmentsInput): Promise<void>
	download(input: DownloadAndVerifyInput): Promise<StorageDownloadResult>
	sessions: StorageSessionStore
}
```

Compose the live runtime from hardcoded Node Clients. Compose a deterministic fixture runtime when
`VITE_DATA_SOURCE === "fixture"`.

- [ ] **Step 4: Inject the runtime through `AppProviders`**

Add an optional `storagePocRuntime` prop and a `useStoragePocRuntime()` hook. Existing callers use the environment
composition root; tests can pass a fake.

- [ ] **Step 5: Run focused tests**

```bash
corepack pnpm test src/storage/runtime.test.ts src/test/render.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/runtime.ts src/storage/runtime-fixture.ts src/app/providers.tsx src/test/render.tsx
git commit -m "feat: compose injectable storage poc runtime"
```

## Task 11: Build the localized `/storage` page

**Files:**
- Create: `src/routes/storage.tsx`
- Create: `src/features/storage-poc/storage-page.tsx`
- Create: `src/features/storage-poc/storage-page.test.tsx`
- Create: `src/features/storage-poc/node-health-panel.tsx`
- Create: `src/features/storage-poc/upload-panel.tsx`
- Create: `src/features/storage-poc/download-panel.tsx`
- Create: `src/features/storage-poc/use-storage-poc.ts`
- Modify: `src/components/app-header.tsx`
- Modify: `src/components/route-metadata.tsx`
- Modify: `src/components/route-metadata.test.tsx`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write route and page tests**

Assert:

- `/storage` metadata is localized;
- main navigation exposes Storage;
- the Local HTTP POC warning is visible;
- node health and download controls work without a wallet;
- empty, over-limit, and valid files have distinct states;
- upload asks for a wallet only after preparation;
- storage fee reads `0 CFX` and network Gas is separate;
- recovery never calls submit twice;
- successful download exposes a save link only after Root verification.

- [ ] **Step 2: Run tests and observe RED**

```bash
corepack pnpm test src/features/storage-poc src/components/route-metadata.test.tsx
```

Expected: FAIL because the route and components do not exist.

- [ ] **Step 3: Add route, metadata, navigation, and translations**

Create:

```ts
export const Route = createFileRoute("/storage")({
	component: StoragePage,
})
```

Add `common.nav.storage`, `common.metadata.title.storage`, and a `storagePoc` namespace containing every
warning, phase, validation, fee, node, upload, download, and integrity label in both locales.

- [ ] **Step 4: Implement the controller hook**

`useStoragePoc` uses `useAccount`, `useChainId`, `useSwitchChain`, `useWalletClient`, and `usePublicClient`.
It must:

1. inspect nodes without a wallet;
2. prepare a selected file;
3. require chain `71`;
4. call `submitStorageFile` exactly once;
5. persist receipt identifiers before polling;
6. wait, upload, verify node state, download, verify Root, and complete;
7. expose retry operations that resume from the current persisted phase.

- [ ] **Step 5: Implement accessible panels and POC styles**

Use semantic headings, labelled file inputs, `<progress>`, `role="status"` for nonurgent progress,
`role="alert"` for blockers, visible focus states, and existing design tokens. The warning text must explicitly
say the HTTP nodes cannot work from a Cloudflare/HTTPS page.

- [ ] **Step 6: Run focused component tests**

```bash
corepack pnpm test src/features/storage-poc src/components/route-metadata.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Regenerate route tree and run typecheck**

```bash
corepack pnpm build
corepack pnpm typecheck
```

Expected: `src/routeTree.gen.ts` contains `/storage` and both commands pass.

- [ ] **Step 8: Commit**

```bash
git add src/routes/storage.tsx src/routeTree.gen.ts src/features/storage-poc \
  src/components/app-header.tsx src/components/route-metadata.tsx \
  src/components/route-metadata.test.tsx src/i18n src/styles/index.css
git commit -m "feat: add localized direct storage poc page"
```

## Task 12: Add deterministic browser coverage

**Files:**
- Create: `tests/e2e/storage-poc.spec.ts`
- Modify: `tests/e2e/localization.spec.ts`
- Modify: `tests/e2e/mobile.spec.ts`

- [ ] **Step 1: Write the failing Playwright flow**

The fixture runtime flow must cover:

```ts
test("prepares, uploads, downloads, and verifies a fixture file", async ({ page }) => {
	await page.goto("/storage")
	await expect(page.getByText("Local HTTP POC")).toBeVisible()
	await page.getByLabel("Choose file").setInputFiles({
		name: "fixture.bin",
		mimeType: "application/octet-stream",
		buffer: Buffer.from([0x71]),
	})
	await expect(page.getByText("0 CFX", { exact: true })).toBeVisible()
	await expect(page.getByText(/network gas/i)).toBeVisible()
	await expect(page.getByText(/Merkle root ready/i)).toBeVisible()
})
```

Use fixture mode to complete non-wallet download verification and a mocked connected-wallet component flow.
Assert no request targets either hardcoded IP during Playwright.

- [ ] **Step 2: Run the new E2E test and observe RED**

```bash
corepack pnpm exec playwright test tests/e2e/storage-poc.spec.ts
```

Expected: FAIL until the route’s fixture runtime and selectors are complete.

- [ ] **Step 3: Complete fixture runtime behavior and responsive assertions**

Add deterministic node health, TxSeq `485`, upload progress, and verified download responses. Add Chinese metadata
and mobile no-horizontal-overflow assertions.

- [ ] **Step 4: Run affected browser tests**

```bash
corepack pnpm exec playwright test tests/e2e/storage-poc.spec.ts tests/e2e/localization.spec.ts tests/e2e/mobile.spec.ts
```

Expected: PASS without live RPC or hardcoded-node requests.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e src/storage/runtime-fixture.ts
git commit -m "test: cover direct storage poc browser flow"
```

## Task 13: Add a read-only Storage Node live probe

**Files:**
- Create: `scripts/harness/storage-node-probe.ts`
- Create: `scripts/harness/storage-node-probe.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write a static safety test**

Assert the probe source contains only the allowed read methods and does not contain:

```text
zgs_upload
submit
writeContract
sendTransaction
privateKey
```

- [ ] **Step 2: Run the safety test and observe RED**

```bash
corepack pnpm test scripts/harness/storage-node-probe.test.ts
```

Expected: FAIL because the probe does not exist.

- [ ] **Step 3: Implement the read-only probe**

Probe both hardcoded nodes with status, shard config, and optional FileInfo for a CLI-provided TxSeq. Compare status
with the current Conflux chain head and print JSON without authorization headers.

Add:

```json
"harness:storage-probe": "tsx scripts/harness/storage-node-probe.ts"
```

- [ ] **Step 4: Run deterministic safety and live read probes**

```bash
corepack pnpm test scripts/harness/storage-node-probe.test.ts
corepack pnpm harness:storage-probe
```

Expected: the safety test passes; the live probe reports chain `71`, pinned Flow address, shard `0/1`, and clearly
marks the lagging node unhealthy without writing data.

- [ ] **Step 5: Commit**

```bash
git add scripts/harness/storage-node-probe.ts scripts/harness/storage-node-probe.test.ts package.json
git commit -m "chore: add read-only storage node probe"
```

## Task 14: Final quality gate and manual transaction handoff

**Files:**
- Create: `docs/manual-tests/2026-07-30-direct-storage-node-poc.md`

- [ ] **Step 1: Run focused deterministic suites**

```bash
corepack pnpm test src/storage src/features/storage-poc src/chain/proxy scripts/harness
```

Expected: PASS with no live writes.

- [ ] **Step 2: Run complete local quality gate**

```bash
corepack pnpm verify
corepack pnpm test:e2e
corepack pnpm harness:validate
corepack pnpm harness:storage-probe
```

Expected: all deterministic checks pass; the live probe performs reads only.

- [ ] **Step 3: Audit forbidden behavior**

```bash
rg -n "pricePerSector|Indexer\\.upload|Uploader|privateKey|sendTransaction" src scripts
rg -n "47\\.84\\.225\\.228|47\\.84\\.224\\.253" src
```

Expected:

- no `pricePerSector`, upstream high-level uploader, private key, or raw send transaction;
- node IPs appear only in `src/storage/config.ts` and tests that explicitly assert hardcoding.

- [ ] **Step 4: Record the user-confirmed manual flow**

Create a checklist containing:

1. start `corepack pnpm dev` and use the HTTP localhost URL;
2. open `/storage`;
3. connect a funded Conflux eSpace testnet wallet;
4. choose a small non-sensitive test file;
5. verify Root and `0 CFX` storage fee;
6. approve exactly one `submit` transaction;
7. record TxHash and TxSeq;
8. verify node sync, Segment upload, download, and Root match;
9. verify a reload resumes without a second transaction;
10. do not place wallet secrets or file contents in the document.

The agent cannot mark this manual step complete until the user confirms the wallet transaction and result.

- [ ] **Step 5: Commit final deterministic work**

```bash
git add docs/manual-tests src scripts tests package.json pnpm-lock.yaml vite.config.ts AGENTS.md .agents/skills
git commit -m "feat: complete direct storage node poc"
```

- [ ] **Step 6: Push the branch without merging**

```bash
git push origin codex/direct-storage-node-poc
```

Expected: remote branch updated; `master` remains unchanged.

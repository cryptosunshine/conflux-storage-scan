# Storage File Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the original file name and MIME into public FixedPriceFlow tags so a verified Storage Node download can restore the source file name.

**Architecture:** A standalone metadata codec owns deterministic encoding, strict decoding, and safe download-name fallback. File preparation passes encoded tags to the upstream SDK; manual downloads resolve the canonical Submit record through the existing read-only `StorageDataSource` and pass its tags into the verified download pipeline.

**Tech Stack:** TypeScript, viem, React, TanStack Query data source, Vitest, Testing Library, Playwright.

---

### Task 1: Metadata codec and file preparation

**Files:**
- Create: `src/storage/metadata/file-metadata.ts`
- Create: `src/storage/metadata/file-metadata.test.ts`
- Modify: `src/storage/sdk/prepare-file.ts`
- Modify: `src/storage/sdk/prepare-file.test.ts`

- [x] **Step 1: Write failing codec and preparation tests**

Cover exact JSON/UTF-8 hex encoding for `t.png`, Unicode names, empty MIME omission, the 255-byte name and 512-byte payload limits, control/path characters, invalid MIME, malformed/unknown tags, safe path removal, `.bin` fallback, and unchanged locked Merkle roots.

Expected API:

```ts
encodeStorageFileMetadata(file: Pick<File, "name" | "type">): Hex
decodeStorageFileMetadata(tags: Hex): StorageFileMetadata | undefined
resolveStorageDownloadMetadata(tags: Hex | undefined, txSeq: number): {
  readonly fileName: string
  readonly mediaType: string
  readonly recovered: boolean
}
```

- [x] **Step 2: Run tests and observe RED**

```bash
corepack pnpm test src/storage/metadata/file-metadata.test.ts src/storage/sdk/prepare-file.test.ts
```

Expected: FAIL because the codec does not exist and prepared tags are still `0x`.

- [x] **Step 3: Implement the codec and pass tags to the SDK**

Use deterministic compact JSON:

```json
{"protocol":"cfx-storage-file","version":1,"name":"t.png","type":"image/png"}
```

Reject invalid upload metadata before wallet interaction. Decode untrusted tags without throwing and return safe fallback metadata for old or malformed submissions.

- [x] **Step 4: Run focused tests and observe GREEN**

```bash
corepack pnpm test src/storage/metadata/file-metadata.test.ts src/storage/sdk/prepare-file.test.ts
```

Expected: PASS.

### Task 2: Contract receipt consistency

**Files:**
- Modify: `src/storage/contract/submit-storage.test.ts`
- Modify: `src/storage/contract/submit-storage.ts`

- [x] **Step 1: Write failing receipt tests**

Assert that the submitted tuple contains encoded tags, a matching Submit event succeeds, and an event with the same Identity but different tags throws `SUBMIT_EVENT_MISSING`.

- [x] **Step 2: Run the contract test and observe RED**

```bash
corepack pnpm test src/storage/contract/submit-storage.test.ts
```

Expected: the mismatched-tags case resolves instead of rejecting.

- [x] **Step 3: Add the minimum event-tags check**

After finding the proxy/Identity event, require:

```ts
matchingLog.args.submission?.tags.toLowerCase() === prepared.submission.data.tags.toLowerCase()
```

- [x] **Step 4: Run the contract test and observe GREEN**

```bash
corepack pnpm test src/storage/contract/submit-storage.test.ts
```

Expected: PASS.

### Task 3: Restore metadata during verified downloads

**Files:**
- Modify: `src/storage/download/download-file.test.ts`
- Modify: `src/storage/download/download-file.ts`
- Modify: `src/features/storage-poc/storage-page.test.tsx`
- Modify: `src/features/storage-poc/use-storage-poc.ts`
- Modify: `src/features/storage-poc/download-panel.tsx`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`

- [x] **Step 1: Write failing download and component tests**

Cover:

```ts
resolveSubmission?: (txSeq: number) => Promise<{
  readonly logicalSizeBytes: bigint
  readonly tags: Hex
} | undefined>
```

Assert that TxSeq and Root downloads restore `t.png`/`image/png`, old `tags=0x` uses `storage-486.bin`, malformed tags do not bypass Root verification, and the UI warns that upload metadata is public.

- [x] **Step 2: Run tests and observe RED**

```bash
corepack pnpm test src/storage/download/download-file.test.ts src/features/storage-poc/storage-page.test.tsx
```

Expected: downloaded files without an in-memory original still use `.bin`, and the public metadata copy is absent.

- [x] **Step 3: Implement read-only metadata lookup**

In `useStoragePoc`, resolve the TxSeq through the existing `StorageDataSource`. Read the local canonical record first; if absent, perform one read-only sync and retry. Treat sync/metadata failure as a filename fallback, not a byte-download failure.

In `download-file.ts`, compare an available Submit logical size with FileInfo, verify downloaded bytes and Root, then create the final `File` using safe decoded metadata. Return whether metadata was recovered so the panel can explain `.bin` fallback.

- [x] **Step 4: Update concise Chinese and English copy**

Replace “tags 0x” with a public metadata notice and add one fallback explanation beneath a successful generic-name download.

- [x] **Step 5: Run affected tests and observe GREEN**

```bash
corepack pnpm test src/storage/download/download-file.test.ts src/features/storage-poc/storage-page.test.tsx
```

Expected: PASS.

### Task 4: Regression and quality gates

**Files:**
- Modify only files required by failures in the affected suites.

- [x] **Step 1: Run storage and UI suites**

```bash
corepack pnpm test src/storage src/features/storage-poc
```

Expected: PASS with no warnings.

- [x] **Step 2: Run the repository gate**

```bash
corepack pnpm verify
```

Expected: lint, typecheck, unit tests, and production build all pass.

- [x] **Step 3: Run the applicable browser flow**

```bash
corepack pnpm test:e2e
```

Expected: PASS.

- [x] **Step 4: Review the final diff and commit**

Confirm no secrets, fixtures, unrelated changes, `.superpowers/`, or `master` merge are present. Commit the implementation on `codex/direct-storage-node-poc`; do not push unless requested.

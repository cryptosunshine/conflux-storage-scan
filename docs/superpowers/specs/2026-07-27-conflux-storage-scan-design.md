# Conflux Storage Scan — Product, Data, UI, and Harness Design

Status: proposed for final review

Date: 2026-07-27

Target network: Conflux eSpace Testnet, chain ID `71`

Primary contract: FixedPriceFlow proxy `0x3fF03285AA79027Ecc552432336FCB85eaD7199e`

## 1. Purpose

Build a read-only Conflux Storage Scan frontend inspired by the information architecture of
[0G StorageScan — Galileo Testnet](https://storagescan-galileo.0g.ai/), while using Conflux
eSpace testnet contract data as the only product data source.

The first release is a client-side React application. It must prove that FixedPriceFlow
events and view calls can support a useful storage explorer without introducing an indexer
service prematurely.

The project also establishes a small-project engineering harness:

- a concise root `AGENTS.md`;
- repository-local, domain-specific Codex skills;
- versioned RPC and contract fixtures;
- deterministic tests and fault injection;
- local quality gates;
- a live probe and automatic fixture capture command.

CI workflows and scheduled live probes are deliberately deferred for the first release.

## 2. Confirmed Product Decisions

| Topic | Decision |
| --- | --- |
| Application framework | Latest stable Vite + React + TypeScript at implementation time |
| Package manager | Latest stable pnpm at implementation time, pinned through `packageManager` and the lockfile |
| Rendering model | Single-page application; no Next.js, SSR, or application backend in MVP |
| Chain access | Conflux eSpace testnet JSON-RPC / Confura-compatible endpoint |
| Contract | FixedPriceFlow proxy at `0x3fF03285AA79027Ecc552432336FCB85eaD7199e` |
| Product scope | Storage submission explorer only |
| Mining | Excluded |
| Rewards | Excluded |
| Upload/write actions | Excluded |
| File download | Excluded |
| Storage fee | Always display `0 CFX`; do not call fee methods |
| Wallet | RainbowKit + wagmi + viem, including EIP-6963 multi-provider discovery |
| Wallet requirement | Optional for public browsing; required only for “My Submissions” |
| Theme | Light theme only |
| Routing | Selectively follows the useful, non-mining 0G routes |
| Cache/error UX | Conventional explorer behavior: cached-first rendering, background refresh, clear partial/stale/error states |
| Fixtures | Live capture automatically creates a new immutable fixture version |
| Fixture safety | Never overwrite a prior version; never automatically commit or push |
| CI | No GitHub Actions or other CI workflow in MVP |

## 3. Sources of Truth

The implementation must distinguish product inspiration from technical truth.

### 3.1 Technical sources of truth

1. Deployed Conflux eSpace testnet bytecode and live RPC responses.
2. The implementation behind the deployed FixedPriceFlow beacon proxy.
3. [0gfoundation/0g-storage-contracts](https://github.com/0gfoundation/0g-storage-contracts),
   inspected at commit `0dcef31fd6398c9aca7267dc5a7a9e1caf3a3581`.
4. ABI artifacts derived from the verified implementation source and pinned by checksum.

If source code, an ABI artifact, and deployed behavior disagree, deployed behavior wins and
the mismatch must be documented before product code proceeds.

### 3.2 Product and visual references

- [0G StorageScan](https://storagescan-galileo.0g.ai/) is an information-architecture and
  interaction reference, not a data-model authority.
- [Conflux eSpace Testnet Scan](https://evmtestnet.confluxscan.org/) and
  [Conflux-Chain/sirius-eth](https://github.com/Conflux-Chain/sirius-eth) are palette and
  secondary style references. The inspected `sirius-eth` revision is
  `745a1b90dd17523447ff4b0d39406761cf1de803`.
- [Conflux-Chain/conflux-hub](https://github.com/Conflux-Chain/conflux-hub) is an engineering
  convention reference, inspected at commit
  `39ce57f451a410d4df40a75405e58c265dcd6aaa`. Its current Vite, React, pnpm, TanStack,
  Tailwind, strict TypeScript, path-alias, and Biome conventions inform this project. Its
  product-specific dependencies and relaxed accessibility lint exceptions do not. It does
  not override this specification.
- The project UI skill is the primary design authority. ConfluxScan’s legacy page composition
  is not to be copied literally.

## 4. Feasibility Findings

The deployed address is not a standalone FixedPriceFlow implementation. It is a beacon proxy:

- FixedPriceFlow proxy:
  `0x3fF03285AA79027Ecc552432336FCB85eaD7199e`
- Beacon:
  `0x7322ba93f0b6061c6fce1af4ac5264cb252a0166`
- Implementation observed on 2026-07-27:
  `0xAd85554aa3446F7199644F852eC7bBa706af3eF9`
- Market:
  `0xB43eE2d86c4Ccb1e958a77a4c52937Cc22255Ac1`

The discovery snapshot returned:

- `paused() == false`;
- `submissionIndex() == 485`;
- `numSubmissions() == 485`;
- `tree().currentLength == 290624` sectors;
- `tree().unstagedHeight == 20`.

At discovery time, the contract history contained:

- 485 `Submit` logs;
- 103 unique transaction hashes;
- up to 20 submissions emitted by one transaction.

The full live log payload was approximately 0.69 MB. This makes a browser-only MVP feasible
today, provided the application uses chunked requests, persistent incremental caching, and
does not assume the dataset will remain small.

These figures are observations, not constants. They must never be hard-coded into product
logic or golden UI assertions.

## 5. Contract Semantics

### 5.1 Primary dataset

The `Submit` event is the canonical source for explorer rows. View methods supply global
state and verification, but they do not replace event history.

Important semantics:

- The event’s indexed `sender` value represents `submission.submitter`. It must be labeled
  **Submitter**, not assumed to be the outer transaction’s `from`.
- `submission.data.length` is the logical submitted data size in bytes.
- The event’s top-level `length` is the number of storage sectors.
- One storage sector is 256 bytes.
- `tree.currentLength` is also denominated in sectors.
- A transaction may emit multiple `Submit` logs because `batchSubmit` is supported.
- The digest constructed from node roots is a submission identity/data-root-like value. The
  UI must call it **Submission Identity** or **Data Root**, not “File Hash” unless later
  source verification proves that label.
- Presence of a `Submit` event proves that the submission was indexed on eSpace. It does not
  prove that arbitrary file content is currently retrievable from a storage node.

### 5.2 Sequence semantics

`submissionIndex` is a zero-based business sequence:

- when `submissionIndex() == 485`, valid observed sequences normally span `0..484`;
- it is useful for routes and display;
- it is not a reorg-safe database primary key.

The canonical record key is:

```text
chainId + contractAddress + blockHash + transactionHash + logIndex
```

The normalized model also maintains a unique `(chainId, contractAddress, sequence)` lookup
index after reorg reconciliation.

### 5.3 Fee semantics

The Conflux testnet version currently has no storage fee. The product therefore:

- renders `0 CFX` from a product constant;
- does not call `pricePerSector`, fee estimation, market pricing, or similar methods;
- does not infer storage fee from transaction gas;
- omits transaction gas fee and gas used from the main detail view to avoid confusing network
  gas with storage pricing.

### 5.4 Unsupported contract concepts

The FixedPriceFlow deployment does not provide the 0G explorer’s mining, reward, miner, or
download concepts. The frontend must not synthesize them.

There are no product write calls in MVP. Wallet connection never authorizes a signature,
transaction, allowance, or contract mutation.

## 6. Routes and Information Architecture

The supported routes deliberately mirror the useful part of 0G StorageScan:

| Route | Purpose | 0G relationship |
| --- | --- | --- |
| `/` | Network summary and recent submissions | Retains the useful dashboard and recent-files pattern |
| `/submissions` | Paginated submission list | Mirrors `/submissions` without download |
| `/submission/:sequence` | Submission detail | Mirrors `/submission/:sequence` with corrected terminology |
| `/address/:address` | Submissions attributed to one submitter | Mirrors `/address/:address` |
| `/history` | Connected wallet’s submissions | Mirrors 0G “My Files”, renamed in copy to “My Submissions” |
| `*` | Not-found state with search and return action | Standard SPA fallback |

Routes deliberately not implemented:

- `/tool`;
- `/files`;
- `/storage`;
- `/topMiners`;
- `/miners`;
- `/miner/:address`;
- `/rewards`;
- any download route;
- an internal transaction detail route.

Transaction hashes link to the corresponding Conflux eSpace testnet transaction page in a
new tab with safe external-link attributes.

### 6.1 Global search

The header search accepts:

- a base-10 sequence number, navigating to `/submission/:sequence`;
- a valid 20-byte EVM address, navigating to `/address/:address`.

It rejects malformed or unsupported input inline. It does not silently treat a transaction
hash as an address and does not make RPC requests for input that fails local validation.

### 6.2 Dashboard

The dashboard contains:

- total contract submissions from `submissionIndex()`;
- indexed submission count from normalized logs;
- indexed logical data size from the sum of `submission.data.length`;
- allocated storage size from `tree.currentLength * 256`;
- storage fee, always `0 CFX`;
- a sync-health indicator;
- five recent submission rows and a link to `/submissions`.

If total contract submissions and indexed log count differ, both values remain visible and a
partial-data warning explains the gap. The page never represents an incomplete local index as
complete.

### 6.3 Submission list

Desktop columns:

1. Sequence
2. Submitter
3. Transaction hash
4. Logical size
5. Storage sectors
6. Fee
7. Age

There is no download column. Mobile layouts retain sequence, submitter, size, and age, with
remaining values available from the row detail affordance.

Pagination follows the 0G interaction pattern but is driven by the local normalized index.
The URL stores the page number so refresh and browser navigation remain stable.

### 6.4 Submission detail

Overview:

- sequence;
- submitter;
- submission identity/data root;
- status: “Indexed on eSpace”;
- logical size;
- storage fee: `0 CFX`;
- start sector;
- end sector, explicitly labeled exclusive if the contract uses an exclusive boundary;
- sector count;
- node count;
- tags, when present.

Chain information:

- block number;
- block hash;
- transaction hash with ConfluxScan external link;
- transaction log index;
- timestamp;
- contract address;
- implementation address used by the active ABI snapshot.

An optional verified `getFlowRootByTxSeq` read may enrich this page. It is not required to list
submissions and must not block rendering of event-backed data.

### 6.5 Address detail

The address page shows:

- checksummed submitter address with copy action;
- total indexed submissions for that submitter;
- total logical bytes attributed to that submitter;
- the same paginated table shape as `/submissions`.

Filtering uses the event’s submission submitter field, not transaction sender.

### 6.6 My Submissions

`/history` is public-route-compatible but account-aware:

- disconnected: show a focused connect-wallet empty state;
- connected on Conflux eSpace testnet: reuse the address query for the active account;
- connected on another network: show the data from the configured public Conflux client and
  offer a network-switch action for wallet consistency;
- switching accounts immediately invalidates the account-scoped query.

Public explorer pages never require connection.

## 7. Application Architecture

### 7.1 High-level structure

```text
React routes and UI
        |
TanStack Query orchestration
        |
StorageDataSource interface
        |
+------------------------+-------------------------+
| LiveRpcDataSource      | FixtureDataSource       |
| viem public client     | deterministic test data |
+------------------------+-------------------------+
        |
Normalizer + reorg reconciler
        |
IndexedDB repository
```

The UI depends on `StorageDataSource`, never directly on RPC transport details. This boundary
allows a future hosted indexer to replace browser-side indexing without rewriting pages.

### 7.2 Selected frontend stack

- Vite;
- React;
- TypeScript in strict mode;
- TanStack Router;
- TanStack Query;
- viem;
- wagmi;
- RainbowKit;
- IndexedDB through a small typed wrapper;
- Tailwind CSS with CSS-variable design tokens;
- Vitest and Testing Library;
- Mock Service Worker or an equivalent fetch-level RPC fixture adapter;
- Playwright for critical browser flows;
- Biome for formatting, linting, and import organization.

Dependencies must be added only when they remove meaningful project complexity. A global
state library is not included unless implementation evidence shows that URL state, React
state, TanStack Query, and wagmi state are insufficient.

### 7.3 Suggested source boundaries

```text
src/
  app/                 composition, providers, router
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

Features may import public types and functions from `chain`, `data`, `wallet`, and shared
components. Chain and data modules must not import page components.

### 7.4 Conflux-aligned code conventions

The project follows the currently observed `conflux-hub` conventions where they improve
consistency:

- ESM-only application code;
- strict TypeScript with unused locals/parameters and unsafe side effects rejected;
- tab indentation and double-quoted JavaScript/TypeScript strings;
- imports organized by Biome;
- explicit Vite and TypeScript path aliases for stable source boundaries;
- Tailwind through its Vite integration;
- route ownership through TanStack Router;
- TanStack Query for asynchronous server/RPC state.

Generated route files are excluded from formatting and manual edits. Product code should
prefer small named functions and components, typed boundary parsers, and explicit return
types on exported chain/data APIs.

The project does not inherit `conflux-hub` exceptions that disable keyboard or accessibility
checks. Explicit `any`, unchecked non-null assertions, and click-only non-interactive elements
require a narrow documented justification.

## 8. RPC Read Strategy

### 8.1 Runtime configuration

The RPC URL is runtime configuration. Credentials and authenticated Confura URLs must not be
committed. The application may provide an official public eSpace testnet endpoint as a
non-secret default, while allowing `VITE_CONFLUX_ESPACE_RPC_URL` to override it.

The public client must enforce chain ID `71`. A mismatched chain response is a blocking data
error, not a warning that can be ignored.

### 8.2 Initial synchronization

The first sync:

1. verifies chain ID, proxy code, beacon, implementation, and ABI compatibility;
2. loads the last durable IndexedDB checkpoint, if present;
3. starts at the verified deployment block when no checkpoint exists;
4. requests `Submit` logs in adaptive block ranges;
5. decodes and validates each log;
6. fetches and caches block timestamps when the log does not include one;
7. writes normalized records and the next checkpoint in one IndexedDB transaction;
8. reconciles the overlapping recent block window before marking the index current.

Block range size grows after successful responses and shrinks after provider limit, timeout,
or response-size errors. A failed chunk is retried with exponential backoff and jitter. The
sync never restarts the entire history solely because one chunk failed.

### 8.3 Incremental refresh and reorgs

Each refresh:

- re-reads an overlapping recent block window rather than trusting only the last block number;
- treats `blockHash` as part of identity;
- removes orphaned records when a previously stored log is absent or marked `removed`;
- inserts the canonical replacement;
- commits records and checkpoint atomically;
- invalidates affected aggregate and address queries.

The default overlapping reorg window is 128 blocks. It is a named configuration constant,
not an environment secret, and reorg fixtures must cross the checkpoint boundary to verify
it. Changing the value requires the deterministic reorg suite to pass.

### 8.4 Timestamp compatibility

The currently observed Confura log response includes `blockTimestamp` and
`transactionLogIndex`. Because `blockTimestamp` is not universally guaranteed by the standard
`eth_getLogs` shape:

- a valid log timestamp is used as an optimization;
- otherwise the client fetches `eth_getBlockByNumber`;
- timestamps are cached by `(chainId, blockHash)`;
- fixtures cover both enriched and standard log shapes.

### 8.5 Read budget

Normal list rendering must not perform one receipt or block request per row. Logs are decoded
in batches, block timestamps are de-duplicated, and optional detail-only reads occur only when
the detail route is opened.

No RPC method related to storage pricing is called.

## 9. Normalized Data Model

Quantities that can exceed JavaScript’s safe integer range remain `bigint` in memory and
decimal strings in fixtures or persisted JSON-shaped records.

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
  tags: readonly Hex[]

  blockNumber: bigint
  blockHash: Hex
  transactionHash: Hex
  transactionIndex: number
  logIndex: number
  transactionLogIndex?: number
  timestamp: number
}
```

Derived display values are not persisted as authority:

- allocated bytes = `sectorCount * 256`;
- fee = `0 CFX`;
- age = `now - timestamp`;
- display status = indexed/sync-state projection.

## 10. Cache and User-Facing Failure Behavior

### 10.1 Cache behavior

IndexedDB stores:

- normalized submissions;
- sequence and submitter indexes;
- block timestamps;
- sync checkpoints;
- the proxy/beacon/implementation identity used for normalization;
- schema and normalizer versions.

On a normal revisit, cached data renders immediately and refreshes in the background.

If schema, ABI, implementation identity, or normalizer version changes incompatibly, the app
opens a new cache namespace or performs an explicit migration. It never silently interprets
old records with new semantics.

### 10.2 Visible states

Every data view supports:

- initial loading;
- empty;
- fresh;
- refreshing;
- stale cached data;
- partial index;
- recoverable RPC failure;
- incompatible contract/ABI;
- corrupt cache recovery.

A transient RPC failure preserves valid cached data and shows its last successful sync time.
An incompatible contract/ABI blocks new decoding and explains that the explorer is waiting
for a verified update.

### 10.3 Recovery

Users can retry RPC reads. Cache corruption offers a narrowly scoped “Rebuild local index”
action that clears only this application’s versioned IndexedDB database after confirmation.
No browser-wide storage is cleared.

## 11. Beacon Proxy Safety

The harness and runtime operate in strict implementation mode.

Before decoding live data, the probe verifies:

- expected chain ID;
- code exists at the configured proxy;
- the EIP-1967 beacon reference;
- code exists at the beacon;
- the beacon’s current implementation;
- the implementation matches the ABI/source snapshot recorded in the manifest.

If the beacon implementation changes:

1. stop decoding new live data with the old ABI;
2. retain already normalized cache only as visibly stale data;
3. inspect and verify the new implementation source;
4. regenerate the ABI and checksum;
5. capture a new fixture version;
6. run normalization, regression, and browser tests;
7. update the accepted implementation manifest.

The application must not “try the old ABI and hope” after an upgrade.

## 12. Wallet Integration

RainbowKit is used for wallet presentation, wagmi for account/connector state, and viem for
chain definitions and RPC primitives.

Required behavior:

- injected wallets discovered through EIP-6963;
- legacy injected provider fallback where supported by wagmi;
- multiple installed wallets shown independently;
- connect and disconnect;
- silent reconnect using wagmi’s standard persistence;
- account change handling;
- chain change handling;
- Conflux eSpace testnet switch/add-network action;
- WalletConnect support only when a project ID is supplied through environment configuration.

EIP-6963 discovery remains enabled through wagmi’s multi-injected-provider discovery
configuration. The project must not collapse all injected wallets into one ambiguous
“Browser Wallet” option.

The live data client is independent of the connected wallet’s provider. A user connected to a
different network can still browse Conflux storage data from the configured public client.

## 13. Visual Design

### 13.1 Direction

The visual result should feel like a current, focused Conflux product:

- information-dense but calm;
- clear hierarchy;
- generous page gutters and card spacing;
- modern table and responsive behavior;
- no decorative mining imagery;
- no copied 0G or ConfluxScan layout;
- no dark theme or theme toggle.

### 13.2 Exact color tokens

The light theme uses the following exact source colors, assigned semantically:

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#17B38A` | primary actions, healthy state, selected accents |
| `--color-primary-soft` | `#AFE9D2` | soft success/selection backgrounds |
| `--color-primary-strong` | `#05343F` | strong brand areas and high-contrast accents |
| `--color-link` | `#1E3DE4` | links |
| `--color-link-hover` | `#0F23BD` | link hover/focus emphasis |
| `--color-interactive` | `#4665F0` | secondary interactive accents |
| `--color-accent-muted` | `#7789D3` | charts and supporting accents |
| `--color-warning` | `#F8963E` | partial/stale warning |
| `--color-surface` | `#FFFFFF` | primary surface |
| `--color-surface-raised` | `#FDFDFE` | cards |
| `--color-canvas` | `#F0F4F3` | page canvas |
| `--color-surface-subtle` | `#F1F3F9` | subtle rows and controls |
| `--color-surface-blue` | `#F5F7FF` | informational panels |
| `--color-border` | `#EBECED` | borders and dividers |
| `--color-text-strong` | `#0F1327` | strongest text |
| `--color-heading` | `#26244B` | headings |
| `--color-text` | `#424A71` | body text |
| `--color-text-muted` | `#65709A` | secondary accessible text |

Exact palette fidelity does not mean every color must appear on every page. Token usage must
preserve readable contrast, visible focus indicators, and semantic consistency.

### 13.3 Core components

- compact sticky application header;
- global search;
- network badge;
- RainbowKit wallet control;
- metric cards;
- sync-health indicator;
- responsive data table;
- address/hash copy control;
- external-link affordance;
- pagination;
- skeletons;
- empty, stale, partial, and blocking error panels.

Desktop and mobile layouts share the same information model. Mobile does not become a
different product or hide the path to critical detail.

## 14. Project-Level Codex Harness

### 14.1 Root `AGENTS.md`

One concise root `AGENTS.md` is used in v1. It contains:

- product invariants;
- sources of truth;
- architecture and dependency boundaries;
- exact skill routing;
- proxy/ABI safety rules;
- fixture rules;
- required local verification;
- definition of done.

Nested `AGENTS.md` files are not introduced until a real subdirectory needs different
instructions.

### 14.2 Repository-local skills

Skills live under `.agents/skills/` so Codex discovers them automatically.

#### `develop-conflux-storage-data`

Use for:

- ABI or contract semantics;
- RPC access;
- event decoding;
- proxy/beacon checks;
- normalization;
- IndexedDB synchronization;
- fixtures and chain fault tests.

It must enforce submitter/size/sector/sequence semantics and the no-fee-call rule.

#### `integrate-rainbowkit-wallets`

Use for:

- RainbowKit;
- wagmi configuration;
- viem chain definitions;
- EIP-6963 and injected wallets;
- WalletConnect;
- account/network state;
- `/history`.

It must enforce read-only MVP behavior and preserve public browsing without a wallet.

#### `design-conflux-storage-ui`

Use for:

- routes and page composition;
- components;
- responsive behavior;
- design tokens;
- loading/empty/error states;
- accessibility and visual regression review.

It must enforce light theme only, the exact Conflux palette, modern visual quality, and the
absence of mining/download UI.

Cross-domain work loads every applicable skill. Examples:

- submission detail data plus UI: data + UI skills;
- wallet history page: wallet + data + UI skills;
- network mismatch error design: wallet + UI skills.

Skill routing improves agent context; deterministic tests remain the correctness mechanism.

## 15. RPC Fixtures and Automatic Live Capture

### 15.1 Layout

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

Each version is immutable after acceptance.

### 15.2 Manifest

The manifest records:

- capture timestamp;
- chain ID;
- non-secret RPC endpoint class;
- proxy, beacon, implementation, and market addresses;
- contract source repository and commit;
- ABI file SHA-256;
- normalizer version;
- deployment/from block;
- captured head block and block hash;
- requested log ranges;
- request and response checksums;
- expected record counts;
- feature flags for optional enriched RPC fields.

Authentication headers, query credentials, wallet data, and unrelated RPC responses are never
written.

### 15.3 Automatic-write interpretation

`pnpm harness:capture` is an explicit developer command that performs a live probe and then
automatically writes a complete new fixture version without interactive file-by-file steps.

The command:

1. runs all proxy and ABI safety checks;
2. captures bounded live RPC requests and responses;
3. normalizes the capture;
4. validates internal invariants;
5. selects the next unused `vN` directory;
6. writes into a temporary sibling directory;
7. verifies checksums and expected outputs;
8. atomically renames the directory to `vN`.

It never:

- overwrites an existing fixture version;
- modifies an accepted fixture in place;
- commits;
- pushes;
- stores secrets;
- writes fixtures from the browser application runtime.

If any probe, normalization, checksum, or invariant step fails, no new version is published.

Because CI and scheduling are deferred, this command is automatic when invoked but is not
initially run on a timer or pull request.

### 15.4 Deterministic expected data

Raw requests and responses remain available for transport fidelity. Separate expected files
store normalized results with all large integers serialized as decimal strings.

Synthetic fixtures cover compact cases that live history may not currently contain, including
empty tags, multiple nodes, a multi-submit transaction, and boundary-sized quantities.

## 16. Fault Injection

The harness must make the following failures reproducible without a live RPC:

- HTTP 429 / provider throttling;
- timeout;
- transient network failure;
- pruned or unavailable block range;
- oversized log-range response;
- partial JSON-RPC batch response;
- duplicated logs;
- out-of-order logs;
- `removed: true` logs;
- same-height reorg with a new block hash;
- malformed event data;
- a missing sequence;
- invalid enriched `blockTimestamp`;
- missing enriched fields;
- corrupt IndexedDB record;
- stale checkpoint;
- changed beacon implementation;
- wrong chain ID.

Expected behavior is asserted at the normalized-data and user-visible-state layers.

## 17. Tests and Local Quality Gates

### 17.1 Unit and contract tests

- ABI checksum and expected event/function surface;
- event decoding;
- submission identity calculation;
- byte/sector calculations;
- sequence boundaries;
- batch submission handling;
- address normalization;
- bigint serialization;
- pagination and aggregate calculations;
- proxy/beacon identity checks;
- reorg reconciliation;
- adaptive range retry behavior.

### 17.2 Component and integration tests

- search routing and validation;
- cached-first rendering;
- loading/empty/fresh/refreshing/stale/partial/error states;
- no download or mining UI;
- fee always `0 CFX`;
- external transaction links;
- disconnected and connected `/history`;
- network mismatch and switch action;
- implementation-change blocking state.

### 17.3 Browser tests

Critical fixture-backed browser flows:

1. dashboard to submissions;
2. search by sequence;
3. search by address;
4. submission detail;
5. address pagination;
6. disconnected wallet history;
7. mocked EIP-6963 multi-wallet discovery;
8. stale cache followed by successful refresh;
9. RPC failure with cached fallback;
10. mobile navigation and table detail access.

### 17.4 Local commands

The implementation exposes at least:

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

`pnpm verify` runs the deterministic local quality gate. It does not contact live RPC.
`pnpm harness:probe` is read-only and live. `pnpm harness:capture` is live and writes one new
immutable fixture version.

No `.github/workflows` or equivalent CI configuration is created in MVP. CI can later execute
the same local commands without changing test semantics.

## 18. Security, Privacy, and Operational Rules

- Product RPC use is read-only.
- Wallet connection requests no signatures or transactions.
- RPC credentials are environment configuration only.
- Fixtures redact headers and credential-bearing URLs.
- Addresses and transaction hashes are public chain data; no analytics profile is built.
- External links use `noopener noreferrer`.
- RPC and IndexedDB payloads are validated before rendering.
- UI never injects decoded bytes as HTML.
- Errors do not expose environment secrets or raw authorization data.
- A provider outage degrades to cached/stale behavior when possible.

## 19. Acceptance Criteria

The MVP is acceptable when:

1. The app loads as a Vite React SPA on desktop and mobile.
2. Public pages work without a connected wallet.
3. Live RPC indexing reconstructs all valid `Submit` records from the verified deployment
   range and resumes incrementally from IndexedDB.
4. Batch submissions create distinct sequence rows even when transaction hashes repeat.
5. Dashboard totals clearly distinguish contract count from indexed count.
6. `/submissions`, `/submission/:sequence`, `/address/:address`, and `/history` behave as
   specified.
7. Every storage fee shown is `0 CFX`, and no fee RPC method is invoked.
8. Mining, rewards, upload, and download UI are absent.
9. Transaction hashes link to Conflux eSpace testnet scan.
10. EIP-6963 presents multiple injected wallets correctly.
11. Wrong network and disconnected wallet states are understandable and recoverable.
12. A beacon implementation change blocks unsafe new decoding.
13. Cached data remains usable during a transient RPC outage and is clearly marked stale.
14. Fixture-backed tests reproduce provider, reorg, malformed-data, and cache failures.
15. `pnpm verify` and the fixture-backed Playwright suite pass locally.
16. `pnpm harness:capture` creates a new checksummed fixture version atomically without
    overwriting, committing, or pushing.
17. Light-theme colors use the exact specified Conflux palette and meet accessibility
    requirements in their assigned roles.
18. The repository contains the root `AGENTS.md` and all three project skills with the routing
    and constraints defined above.

## 20. Explicit Non-Goals

- mining, miner rankings, rewards, epochs, or mining economics;
- upload tools or contract writes;
- file download or storage-node retrieval;
- storage availability verification;
- server-side rendering;
- a hosted API, database, or shared indexer;
- transaction detail pages;
- fee discovery or estimation;
- dark theme;
- analytics;
- CI workflow configuration;
- automatic Git commits or pushes from live capture.

## 21. Deferred Evolution

If browser-side indexing becomes too slow or provider limits become materially restrictive, a
hosted indexer may implement the same `StorageDataSource` contract. The frontend routes and
normalized domain model should remain stable.

CI and scheduled read-only live probes can be added later by invoking the already-defined
local commands. Any future automatic fixture-update pull request requires a separate explicit
decision because it changes repository state and review workflow.

## 22. Remaining Gate Before Implementation

There are no unresolved product decisions required to write the implementation plan. The only
remaining gate is approval of this actual design document.

After approval:

1. create the step-by-step implementation plan;
2. scaffold the Vite React project and project harness;
3. implement contract/RPC foundations using fixture-first tests;
4. implement routes and wallet integration;
5. apply the design system and responsive states;
6. verify locally against fixtures and a read-only live probe.

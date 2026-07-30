# Conflux Storage Scan project instructions

## Product invariants

- Keep the product read-only. Never add upload, download, mining, reward, signing, approval, or contract-write behavior.
- Display the storage fee as the product constant `0 CFX`. Never call `pricePerSector` or infer storage fees from transaction gas.
- Public explorer routes must work without a wallet. Wallet connection is only required for `/history`.
- `/analytics` is a public, read-only route derived from the canonical local index. Chart reads must make no additional RPC requests.
- Support Light Theme only.

## branch-only Storage Node POC

- Only on `codex/direct-storage-node-poc`, `/storage` may request a user-confirmed FixedPriceFlow `submit`
  transaction and direct Storage Node upload/download.
- Keep all explorer routes and `StorageDataSource` read-only; the POC must use a separate runtime boundary.
- Submit only on chain ID `71` to the pinned FixedPriceFlow proxy with `value: 0n`.
- Never call `pricePerSector`, infer a storage price, or invoke the upstream high-level uploader.
- Never put a signer or real write into deterministic tests or Harness scripts.
- Never merge this POC into `master` without a separate product and security review.

## Sources of truth

- Chain truth comes from Conflux eSpace Testnet chain ID `71`, the deployed FixedPriceFlow BeaconProxy, its verified implementation, and pinned ABI fixtures.
- Read `docs/superpowers/specs/2026-07-27-conflux-storage-scan-design.zh-CN.md` before changing product behavior.
- Follow `docs/superpowers/plans/2026-07-28-conflux-storage-scan-mvp.md` while implementing the MVP.
- Follow `docs/superpowers/specs/2026-07-30-direct-storage-node-poc-design.zh-CN.md` and
  `docs/superpowers/plans/2026-07-30-direct-storage-node-poc.md` for the branch-only POC.
- If the Beacon implementation changes, stop live decoding until source, ABI, fixtures, and regression tests are re-verified.

## Architecture and code

- UI code depends on `StorageDataSource`; routes and components must not call RPC directly.
- `/storage` depends on an injected Storage POC runtime; its components must not call chain or Node RPC directly.
- Use strict TypeScript, Biome, TanStack Router/Query, Tailwind CSS, viem, RainbowKit, and wagmi 2.
- Keep large integers as `bigint` in memory and decimal strings in persisted JSON.
- Treat `(chainId, contractAddress, blockHash, transactionHash, logIndex)` as the canonical event identity.
- Use `corepack pnpm` in this repository so commands honor `packageManager: pnpm@11.17.0`.

## Skill routing

- Chain, ABI, RPC, event, IndexedDB, sync, fixture, or reorg work requires `develop-conflux-storage-data`.
- RainbowKit, wagmi, viem wallet chain, EIP-6963, WalletConnect, account, or network work requires `integrate-rainbowkit-wallets`.
- Route, page, component, style, responsive, accessibility, or visual-state work requires `design-conflux-storage-ui`.
- Cross-domain changes must load every matching skill.

## Workflow and verification

- Do not use worktrees for this project.
- Create a `codex/` feature branch for each functional module, push it to `origin`, and keep unrelated modules out of the branch.
- Follow TDD for product behavior: observe the failing test, implement the minimum change, then rerun the focused and affected suites.
- Run `corepack pnpm verify`; run `corepack pnpm test:e2e` for user-flow changes.
- Run `corepack pnpm verify:ui` before completing any UI, layout, style, or responsive change.
- Merge ordinary functional branches into `master` only after their required tests pass, then push the updated `master`.
- Keep `codex/direct-storage-node-poc` remote-only after verification; do not merge it into `master`.
- Live commands are `corepack pnpm harness:probe` and `corepack pnpm harness:capture`; deterministic tests must never call live RPC.
- Never overwrite an accepted fixture version or automatically commit or push captured fixtures.
- MVP has no CI workflow. Do not add `.github/workflows/`.

## Definition of done

- Required focused tests, `corepack pnpm verify`, and applicable browser tests pass with clean output.
- Product invariants remain covered by tests and static Harness validation.
- The branch contains no secrets, captured authorization headers, `.superpowers/`, or unrelated user changes.

---
name: develop-conflux-storage-data
description: Use when changing FixedPriceFlow ABI, Conflux eSpace RPC, Submit decoding, IndexedDB sync or cache, BeaconProxy verification, live probes, fixtures, reorg handling, or chain fault tests in this repository.
---

# Develop Conflux Storage Data

## Core rule

Treat deployed chain behavior as truth and keep product reads deterministic, upgrade-safe, and
fee-free. Never let a UI convenience redefine contract semantics.

## Required context

Read before editing:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-07-27-conflux-storage-scan-design.zh-CN.md`
3. The applicable task in `docs/superpowers/plans/2026-07-28-conflux-storage-scan-mvp.md`
4. Current ABI, fixture manifest, and focused tests

**REQUIRED SUB-SKILL:** Use `superpowers:test-driven-development` for behavior changes.
Use `superpowers:systematic-debugging` for unexpected RPC, build, or test failures.

## Contract invariants

- Target chain ID `71`.
- FixedPriceFlow proxy: `0x3fF03285AA79027Ecc552432336FCB85eaD7199e`.
- Verify the EIP-1967 Beacon and its implementation before decoding live data.
- Stop new decoding when the Beacon implementation differs from the accepted manifest.
- Map event `sender` to `submission.submitter`, not transaction `from`.
- Map `submission.length` to logical bytes.
- Map event top-level `length` to storage sectors; one sector is `256` bytes.
- Preserve every `Submit` log from `batchSubmit`; never deduplicate by transaction hash.
- Verify event identity as `keccak256` of packed node roots.
- Keep large quantities as `bigint` in memory and decimal strings in JSON-shaped persistence.
- Display storage fee as `0 CFX`. Never call `pricePerSector` or derive it from gas.
- Never add `submit`, `batchSubmit`, signing, approval, or transaction-sending code.

## Data workflow

1. Write a focused failing test from a fixture.
2. Keep transport, normalization, persistence, and UI projections separate.
3. Use `(chainId, contractAddress, blockHash, transactionHash, logIndex)` as canonical identity.
4. Re-read a 128-block overlap and atomically reconcile orphaned logs with checkpoints.
5. Use enriched `blockTimestamp` only as an optimization; fall back to block reads and cache by
   block hash.
6. Surface stale, partial, incompatible-contract, and recoverable RPC states explicitly.
7. Run deterministic tests before a read-only live probe.

## Fixture safety

- Never access live RPC from ordinary unit, component, or browser tests.
- Make `harness:probe` read-only.
- Make `harness:capture` write the next unused version through a temporary sibling directory and
  atomic rename.
- Never overwrite an accepted version, include credentials, or automatically commit or push.
- Cover throttling, timeout, pruning, oversized ranges, partial batches, duplicates, ordering,
  removed logs, reorgs, malformed data, gaps, corrupt cache, changed implementation, and wrong chain.

## Verification

Run the smallest focused RED/GREEN command first, then:

```bash
corepack pnpm test src/chain src/data scripts/harness
corepack pnpm typecheck
corepack pnpm lint
```

For live-sensitive work, finish with:

```bash
VITE_CONFLUX_ESPACE_RPC_URL=https://evmtestnet.confluxrpc.com corepack pnpm harness:probe
```

Do not accept a live probe as a substitute for fixture-backed regression tests.

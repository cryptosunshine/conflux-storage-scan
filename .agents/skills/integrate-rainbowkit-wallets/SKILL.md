---
name: integrate-rainbowkit-wallets
description: Use when changing RainbowKit, wagmi, viem wallet chains, EIP-6963 discovery, injected connectors, WalletConnect, account or network state, connect controls, or the /history route in this repository.
---

# Integrate RainbowKit Wallets

## Core rule

Keep wallet access optional and read-only. Public explorer data always comes from the configured
Conflux public client, never from the connected wallet provider.

## Required context

Read:

1. `AGENTS.md`
2. Design Spec sections 6.6 and 12
3. The applicable implementation-plan task
4. Current wallet tests and provider composition

**REQUIRED SUB-SKILL:** Use `superpowers:test-driven-development` for wallet behavior.
Load `design-conflux-storage-ui` when changing visible wallet states.

## Version and configuration constraints

- Use RainbowKit `2.2.11`, wagmi `2.19.5`, viem `2.x`, and TanStack Query `5.x`.
- Do not upgrade to wagmi 3 while RainbowKit requires wagmi `^2.9.0`.
- Define Conflux eSpace Testnet with chain ID `71`, CFX native currency, configured HTTP RPC, and
  `https://evmtestnet.confluxscan.org`.
- Keep wagmi `multiInjectedProviderDiscovery: true` so EIP-6963 providers remain distinct.
- Preserve legacy injected fallback supported by wagmi.
- Add WalletConnect only when `VITE_WALLETCONNECT_PROJECT_ID` is non-empty.
- Never commit a WalletConnect project ID or authenticated RPC URL.

## Required behavior

- Support connect, disconnect, silent reconnect, account changes, and chain changes.
- Present multiple EIP-6963 wallets separately; never collapse them into one ambiguous
  “Browser Wallet”.
- Let disconnected users browse every public route.
- Require a wallet only for `/history`.
- On chain ID `71`, query submissions for the active account.
- On another wallet chain, continue showing Conflux data from the public client and offer
  `switchChain({ chainId: 71 })`.
- Include account and page in query keys; cancel or invalidate old account queries on change.
- Keep the connected connector out of `StorageDataSource` and chain-sync constructors.

## Forbidden behavior

Do not add:

- signatures or message signing;
- `writeContract`, `sendTransaction`, approvals, allowances, or submitted transactions;
- upload or download actions;
- a requirement to connect before searching or opening explorer routes;
- wallet-provider RPC as a fallback for public indexing.

## Test workflow

Write failing tests for:

- chain ID and explorer configuration;
- EIP-6963 multi-wallet discovery;
- absence of WalletConnect without configuration;
- disconnected `/history`;
- connected account filtering;
- wrong-network switch action;
- account changes and query invalidation;
- continued public browsing without a wallet.

Use mocked providers only at the connector boundary. Assert user-visible behavior and wagmi state,
not internal call counts when a real state transition is testable.

## Verification

```bash
corepack pnpm test src/wallet src/features/wallet-history
corepack pnpm typecheck
corepack pnpm lint
```

Run fixture-backed Playwright wallet flows after visible integration changes. Never use a live wallet
or request a real signature in automated tests.

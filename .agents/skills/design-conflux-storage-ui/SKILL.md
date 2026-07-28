---
name: design-conflux-storage-ui
description: Use when changing Conflux Storage Scan routes, pages, React components, Tailwind styles, design tokens, responsive tables, accessibility, loading or error states, visual tests, or explorer copy in this repository.
---

# Design Conflux Storage UI

## Core rule

Build a modern, accessible Conflux explorer in Light Theme only. Use 0G for information
architecture, the exact Conflux palette for identity, and this project’s semantics for copy.

## Required context

Read `AGENTS.md`, Design Spec sections 6 and 13, the active implementation-plan task, and the
existing component tests.

**REQUIRED SUB-SKILLS:**

- Use `frontend-skill` before creating or materially changing pages.
- Use `vercel-react-best-practices` for React implementation.
- Use `web-design-guidelines` for final UI review.
- Load `develop-conflux-storage-data` for data-backed UI and
  `integrate-rainbowkit-wallets` for wallet states.

## Product structure

Support:

- `/`
- `/submissions`
- `/submission/:sequence`
- `/address/:address`
- `/history`

Never add mining, rewards, upload, download, `/tool`, miner routes, or an internal transaction
detail page. Link transaction hashes to Conflux eSpace Testnet Scan.

Use “Submission Identity / Data Root”, “Submitter”, logical bytes, storage sectors, and
“Indexed on eSpace”. Display fee as `0 CFX`. Do not call it a file hash or imply retrievability.

## Visual system

Use these exact tokens:

```text
#17B38A primary          #AFE9D2 primary soft
#05343F primary strong   #1E3DE4 link
#0F23BD link hover       #4665F0 interactive
#7789D3 muted accent     #F8963E warning
#FFFFFF surface          #FDFDFE raised surface
#F0F4F3 canvas           #F1F3F9 subtle surface
#F5F7FF info surface     #EBECED border
#0F1327 strong text      #26244B heading
#424A71 body text        #65709A muted text
```

Preserve accessible contrast and visible focus; exact palette fidelity does not justify low
contrast. Do not add Dark Theme, a theme toggle, generic gradients, or copied ConfluxScan layouts.

## Component behavior

- Keep the header compact and usable by keyboard.
- Make global search locally validate decimal sequence or 20-byte EVM address before navigation.
- Keep pagination in URL state.
- Use semantic tables on desktop and accessible row-detail treatment on mobile.
- Truncate addresses and hashes visually while retaining full copy value and accessible label.
- Use `<time dateTime>` for timestamps and safe external-link attributes.
- Provide skeleton, empty, refreshing, stale, partial, recoverable error, corrupt cache, and
  incompatible-contract states.
- Keep valid cached content visible during transient RPC errors.
- Respect `prefers-reduced-motion` and avoid layout shift.

## Test workflow

Write a failing user-facing test first. Cover keyboard names, route state, critical copy, fee `0 CFX`,
absence of mining/download UI, mobile access to details, and every data state. Prefer queries by role
and accessible name over test IDs.

## Verification

```bash
corepack pnpm test src/components src/features
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:e2e
```

Inspect 1440px, 1024px, and 390px widths in a real browser. Fix visual or accessibility defects with
a failing regression test before changing implementation.

# Conflux Storage Scan Brand Product Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prototype branding with pinned Conflux eSpace assets, localized route metadata, product-grade explorer copy, and a compact trust-oriented Footer without changing explorer data behavior.

**Architecture:** Keep branding and install metadata in Vite static assets, derive runtime document metadata only from TanStack Router location and i18next, and keep Header/Footer as presentation-only components. No new RPC, storage-data-source, wallet, analytics, or contract behavior is introduced.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, TanStack Router, i18next, Lucide React, CSS, Vitest, Testing Library, Playwright.

---

### Task 1: Publish pinned official brand assets and static metadata

**Files:**
- Create: `src/test/brand-assets.test.ts`
- Create: `public/favicon.ico`
- Create: `public/logo192.png`
- Create: `public/logo512.png`
- Create: `public/espace-icon.svg`
- Create: `public/manifest.webmanifest`
- Modify: `index.html`
- Delete: `public/favicon.svg`

- [ ] **Step 1: Write the failing static asset regression**

Create `src/test/brand-assets.test.ts` with assertions that:

```ts
const assetHashes = {
	"favicon.ico": "2e72e4569660e6b134e1c43559b9baa4ee762df2f37146fd55671c8eb0e752b7",
	"logo192.png": "0b70f4ed4050da15245521a10e20ef959d4895027d04c824aa10d898d0db2a1b",
	"logo512.png": "074902f14de0102a5f57d932956535818ae0ed1a037c1fecb5adcd0e446bde80",
	"espace-icon.svg": "5f577db55f89a8ddb06518a93af1134d95fa926d8464c4df970c65b3da7dedf4",
}
```

The test must verify the four hashes, the absence of `public/favicon.svg`, and these exact defaults:

```html
<title>Conflux Storage Explorer — Conflux Storage Scan</title>
<meta name="description" content="Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet." />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/logo192.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

It must also parse the manifest and assert `name`, `short_name`, `description`, `start_url`,
`display`, both colors, and the 192px/512px icon entries.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm test src/test/brand-assets.test.ts
```

Expected: FAIL because the official assets and manifest do not exist and `index.html` still references
the prototype SVG and title.

- [ ] **Step 3: Add the pinned assets**

Download the files from commit `f99f137fe1f1da1f08c2bd74fdac817e7e0e2b5f`:

```bash
curl -fsSL https://raw.githubusercontent.com/Conflux-Chain/sirius-eth/f99f137fe1f1da1f08c2bd74fdac817e7e0e2b5f/public/favicon.ico -o public/favicon.ico
curl -fsSL https://raw.githubusercontent.com/Conflux-Chain/sirius-eth/f99f137fe1f1da1f08c2bd74fdac817e7e0e2b5f/public/logo192.png -o public/logo192.png
curl -fsSL https://raw.githubusercontent.com/Conflux-Chain/sirius-eth/f99f137fe1f1da1f08c2bd74fdac817e7e0e2b5f/public/logo512.png -o public/logo512.png
curl -fsSL https://raw.githubusercontent.com/Conflux-Chain/sirius-eth/f99f137fe1f1da1f08c2bd74fdac817e7e0e2b5f/src/images/espace/icon.svg -o public/espace-icon.svg
```

Delete `public/favicon.svg` only after the new references are present.

- [ ] **Step 4: Add the manifest and static HTML metadata**

Create `public/manifest.webmanifest` with:

```json
{
	"name": "Conflux Storage Scan",
	"short_name": "Storage Scan",
	"description": "Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet.",
	"start_url": "/",
	"display": "standalone",
	"background_color": "#F0F4F3",
	"theme_color": "#F0F4F3",
	"icons": [
		{ "src": "/logo192.png", "sizes": "192x192", "type": "image/png" },
		{ "src": "/logo512.png", "sizes": "512x512", "type": "image/png" }
	]
}
```

Update `index.html` to the exact title, description, theme color, favicon, Apple Touch Icon, and
manifest links from Step 1.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
corepack pnpm test src/test/brand-assets.test.ts
```

Expected: PASS with all pinned hashes and metadata verified.

- [ ] **Step 6: Commit the static brand foundation**

Run:

```bash
git add index.html public src/test/brand-assets.test.ts
git commit -m "feat: publish Conflux eSpace brand assets"
```

Expected: one focused commit containing only pinned assets, static metadata, manifest, and its test.

### Task 2: Localize document metadata by route

**Files:**
- Create: `src/components/route-metadata.tsx`
- Create: `src/components/route-metadata.test.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`

- [ ] **Step 1: Write the failing metadata tests**

Create a router-backed test that renders `RouteMetadata` and verifies:

```ts
expect(document.title).toBe("Conflux Storage Explorer — Conflux Storage Scan")
expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
	"content",
	"Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet.",
)
```

Cover `/submissions`, `/submission/484`, `/address/0x6493d9d03A...AB8d`, `/history`,
`/analytics`, and an unknown route. Switch test i18n to Chinese and verify the equivalent Chinese
titles and description. The address expectation must use the shared local shortening rule
`0x6493…AB8d`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm test src/components/route-metadata.test.tsx
```

Expected: FAIL because `RouteMetadata` and metadata translation keys do not exist.

- [ ] **Step 3: Implement local-only route metadata**

Create `RouteMetadata` so it:

```ts
const pathname = useRouterState({ select: (state) => state.location.pathname })
```

matches exact public routes plus `/history`, extracts only the route parameter for submission and
address titles, shortens addresses to the first six and last four characters, and falls back to the
generic explorer title. In an effect, set `document.title` and update the existing
`meta[name="description"]`. The component must not import or call `StorageDataSource`, TanStack
Query, viem, wagmi, or RPC code.

- [ ] **Step 4: Add exact English and Chinese metadata translations**

Under `common.metadata`, add the localized description and these title keys:

```ts
title: {
	address: "Address {{address}} — Conflux Storage Scan",
	analytics: "Storage Analytics — Conflux Storage Scan",
	explorer: "Explorer Page — Conflux Storage Scan",
	history: "My Submissions — Conflux Storage Scan",
	overview: "Conflux Storage Explorer — Conflux Storage Scan",
	submission: "Submission #{{sequence}} — Conflux Storage Scan",
	submissions: "Storage Submissions — Conflux Storage Scan",
}
```

Add the Chinese equivalents defined in the approved design spec.

- [ ] **Step 5: Mount metadata in every shell state**

Render `<RouteMetadata />` once inside `RootLayout` and once inside `RouteErrorPage` so normal,
not-found, and route-error shells all receive a deterministic local title without additional data
reads.

- [ ] **Step 6: Run focused and affected tests**

Run:

```bash
corepack pnpm test src/components/route-metadata.test.tsx src/test/smoke.test.tsx
```

Expected: PASS; language changes update the title/description and shell rendering remains intact.

- [ ] **Step 7: Commit route metadata**

Run:

```bash
git add src/components/route-metadata.tsx src/components/route-metadata.test.tsx src/routes/__root.tsx src/i18n/resources
git commit -m "feat: localize explorer route metadata"
```

Expected: one focused commit with no static asset, RPC, data-source, or wallet changes.

### Task 3: Productize Header, Footer, and core explorer copy

**Files:**
- Modify: `src/components/app-header.tsx`
- Modify: `src/components/app-footer.tsx`
- Modify: `src/styles/index.css`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`
- Modify: `src/test/smoke.test.tsx`
- Modify: `src/features/search/global-search.test.tsx`
- Modify: `src/features/dashboard/dashboard-page.test.tsx`
- Modify: `tests/e2e/explorer.spec.ts`
- Modify: `tests/e2e/localization.spec.ts`
- Modify: `tests/e2e/mobile.spec.ts`

- [ ] **Step 1: Write failing Header and Footer regressions**

Extend the smoke test to require:

```ts
expect(screen.getByRole("link", { name: "Conflux Storage Scan overview" }).querySelector("img"))
	.toHaveAttribute("src", "/espace-icon.svg")
expect(screen.getByRole("contentinfo")).toHaveTextContent(
	"Read-only explorer for FixedPriceFlow storage submissions.",
)
```

Require the Footer links for Conflux eSpace Testnet, the exact FixedPriceFlow address, and GitHub to
have the approved `href`, `target="_blank"`, and `rel="noopener noreferrer"` attributes. Also
require a visible `Read-only` status.

- [ ] **Step 2: Write failing copy regressions**

Update focused dashboard and search tests to require:

```text
Conflux eSpace Storage
Explore canonical FixedPriceFlow submissions indexed from Conflux eSpace Testnet.
FixedPriceFlow sequence counter
Validated canonical Submit events
Total bytes declared by indexed submissions
No storage fee on this testnet
Search by submission sequence or submitter address
Sequence 484 or 0x… submitter
```

Add equivalent assertions after switching to Chinese. Update Playwright selectors to the new
accessible search name so user-flow coverage remains semantic.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
corepack pnpm test src/test/smoke.test.tsx src/features/search/global-search.test.tsx src/features/dashboard/dashboard-page.test.tsx
```

Expected: FAIL because the Header still renders a generic database SVG and the current Footer/copy
does not provide the approved product information.

- [ ] **Step 4: Replace the Header mark**

Remove the `Database` import and render:

```tsx
<span aria-hidden="true" className="brand__mark">
	<img alt="" height={24} src="/espace-icon.svg" width={24} />
</span>
```

Keep the brand link, visible product name, navigation, search, network badge, wallet behavior, and
header height unchanged.

- [ ] **Step 5: Implement the compact trust Footer**

Build two semantic groups:

1. Product name, localized descriptor, and localized read-only status.
2. Safe external links for network, `FixedPriceFlow 0x3fF0…7199`, GitHub, then the existing
   `LanguageSelect`.

Use `ExternalLink` as a decorative icon, keep all link text visible, and apply
`target="_blank" rel="noopener noreferrer"`.

- [ ] **Step 6: Add localized product copy**

Replace the dashboard, search, and Footer keys with the exact bilingual strings from the approved
design. Add Footer resource navigation labels for accessibility. Do not change `0 CFX`,
`Submission Identity`, `Submitter`, logical bytes, sector, transaction, or indexed-status
semantics.

- [ ] **Step 7: Style desktop, tablet, and mobile Footer/Header**

Keep the eSpace mark in the existing 32px brand slot. Make the Footer a compact two-tier surface
with visible focus states and wrapping link groups. At 390px stack product identity, trust links,
and language selector without horizontal overflow. Respect current Light Theme tokens and
`prefers-reduced-motion`.

- [ ] **Step 8: Run focused and affected tests**

Run:

```bash
corepack pnpm test src/test/smoke.test.tsx src/features/search/global-search.test.tsx src/features/dashboard/dashboard-page.test.tsx src/components/language-select.test.tsx
corepack pnpm exec playwright test tests/e2e/explorer.spec.ts tests/e2e/localization.spec.ts tests/e2e/mobile.spec.ts
```

Expected: PASS with accessible search, Footer links, language selection, and mobile explorer flows.

- [ ] **Step 9: Inspect the real interface**

At 1440px, 1024px, and 390px verify:

- Header brand is crisp, aligned, and does not displace navigation/search.
- Footer content hierarchy is clear and all external links have visible hover/focus states.
- Chinese and English copy does not collide or create horizontal overflow.
- Language popup remains compact and within the viewport.
- Browser title changes immediately with route and language.
- No console error and no unexpected RPC request is introduced by metadata or Footer rendering.

- [ ] **Step 10: Run final design and project gates**

Run:

```bash
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm test:e2e
```

Review the changed interface against Web Interface Guidelines. Expected: Harness validation,
Biome, typecheck, unit tests, build, and Playwright pass with only pre-existing documented build
warnings, if any.

- [ ] **Step 11: Commit, push, merge, and re-verify**

Run:

```bash
git add src/components src/features src/i18n src/styles src/test tests/e2e
git commit -m "feat: polish explorer brand experience"
git push -u origin codex/productize-brand-experience
git switch master
git merge --ff-only codex/productize-brand-experience
corepack pnpm verify
corepack pnpm test:e2e
git push origin master
```

Expected: the feature branch and `master` contain the complete product polish on `origin`, with all
required gates passing in the merged state.

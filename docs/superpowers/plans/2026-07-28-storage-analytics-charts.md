# Storage Analytics Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two data-backed trend cards to the dashboard and an accessible `/analytics` detail page without adding RPC calls or server-side infrastructure.

**Architecture:** A pure UTC-day aggregation function turns the complete canonical local submission index into `bigint` timeline points. `StorageDataSource` exposes the result, TanStack Query caches it, and Recharts renders responsive previews and detail charts while semantic summaries and tables preserve accessibility.

**Tech Stack:** TypeScript 5.9, React 19, TanStack Router/Query, IndexedDB (`idb`), Recharts, Vitest/Testing Library, Playwright, Biome, pnpm 11.

---

## 0. Constraints

- Work directly in `codex/storage-analytics-charts`; do not create a worktree.
- Keep the explorer read-only and Light Theme only.
- Do not add Cloudflare code, mining, rewards, Gas, upload, download, or fee RPC reads.
- Use `0 CFX` everywhere fees appear.
- Write a failing behavior test before each implementation slice.
- Deterministic tests must not contact live RPC.
- Do not commit `.superpowers/`, `dist/`, credentials, screenshots, or unrelated files.

## 1. Target File Structure

### Create

- `src/analytics/types.ts` — timeline and range domain types.
- `src/analytics/build-storage-timeline.ts` — pure UTC aggregation and range selection.
- `src/analytics/build-storage-timeline.test.ts` — aggregation boundary tests.
- `src/data/queries.test.ts` — analytics invalidation tests.
- `src/components/charts/chart-format.ts` — safe chart coordinate and tooltip formatting.
- `src/components/charts/chart-data-table.tsx` — screen-reader-accessible daily values.
- `src/components/charts/storage-growth-chart.tsx` — logical/allocated lines.
- `src/components/charts/submission-activity-chart.tsx` — daily bars.
- `src/components/charts/charts.test.tsx` — semantic chart tests.
- `src/features/analytics/analytics-preview-cards.tsx` — linked dashboard cards.
- `src/features/analytics/analytics-page.tsx` — detail page and range controls.
- `src/features/analytics/analytics-page.test.tsx` — page state and interaction tests.
- `src/routes/analytics.tsx` — validated `metric` and `range` URL state.
- `src/routes/-route-validation.test.ts` — analytics query normalization tests.

### Modify

- `package.json`, `pnpm-lock.yaml` — pin Recharts.
- `AGENTS.md` — authorize the new read-only analytics route.
- `.agents/skills/design-conflux-storage-ui/SKILL.md` — add `/analytics` and chart rules.
- `scripts/validate-agent-harness.mjs` — require analytics constraints.
- `src/data/indexed-db/storage-db.ts` — add an unpaginated internal `listAll`.
- `src/data/storage-data-source.ts` — expose `getAnalyticsTimeline`.
- `src/data/fixture-data-source.ts` — aggregate fixture submissions.
- `src/data/live-rpc-data-source.ts` — aggregate canonical IndexedDB submissions.
- `src/data/queries.ts` — add analytics key/query/invalidation.
- `src/data/storage-data-source.test.ts` — enforce data-source parity and no extra RPC.
- `src/test/browser-fixture-data-source.ts` — forward analytics.
- `src/test/render.tsx` — include analytics route in the test router when required.
- `src/features/dashboard/dashboard-page.tsx` — insert previews before recent activity.
- `src/features/dashboard/dashboard-page.test.tsx` — assert previews and links.
- `src/routes/-route-validation.ts` — normalize analytics query parameters.
- `src/routeTree.gen.ts` — regenerate through the TanStack Router plugin.
- `src/styles/index.css` — chart, card, controls, responsive and reduced-motion styles.
- `tests/e2e/explorer.spec.ts` — dashboard-to-analytics and URL range flow.
- `tests/e2e/mobile.spec.ts` — mobile layout and overflow.
- `README.md` — document the analytics route and local-index-only data source.

## Task 1: Align the Project Harness

**Files:**
- Modify: `AGENTS.md`
- Modify: `.agents/skills/design-conflux-storage-ui/SKILL.md`
- Modify: `scripts/validate-agent-harness.mjs`

- [x] **Step 1: Add a failing Harness requirement**

Add `"/analytics"` and `"no additional RPC"` to the required UI skill rules:

```js
[
  ".agents/skills/design-conflux-storage-ui/SKILL.md",
  ["Light Theme", "#17B38A", "/submissions", "/history", "/analytics", "no additional RPC", "download", "mining"],
]
```

- [x] **Step 2: Verify the Harness fails**

Run:

```bash
corepack pnpm harness:validate
```

Expected: FAIL because the UI skill does not yet contain both new rules.

- [x] **Step 3: Update project constraints**

Add `/analytics` to the public route lists in `AGENTS.md` and the UI skill. State that analytics is
derived from the canonical local index and must not trigger additional RPC reads. Keep the forbidden
mining/download/fee behavior unchanged.

- [x] **Step 4: Verify the Harness passes**

Run:

```bash
corepack pnpm harness:validate
```

Expected: `Validated 4 agent harness files`.

- [x] **Step 5: Commit**

```bash
git add AGENTS.md .agents/skills/design-conflux-storage-ui/SKILL.md scripts/validate-agent-harness.mjs
git commit -m "chore: authorize storage analytics route"
```

## Task 2: Build the UTC Timeline Domain

**Files:**
- Create: `src/analytics/types.ts`
- Create: `src/analytics/build-storage-timeline.ts`
- Test: `src/analytics/build-storage-timeline.test.ts`

- [x] **Step 1: Write failing aggregation tests**

Cover unsorted input, two UTC dates, a missing date, cumulative logical bytes, maximum end sector,
empty input, and range selection. Use fixed timestamps and a fixed `asOfTimestamp`:

```ts
const asOfTimestamp = Date.UTC(2026, 6, 4, 12) / 1_000
const result = buildStorageTimeline(
  [
    createSubmissionFixture(2n, {
      timestamp: Date.UTC(2026, 6, 3, 1) / 1_000,
      logicalSizeBytes: 5n,
      endSectorExclusive: 40n,
    }),
    createSubmissionFixture(1n, {
      timestamp: Date.UTC(2026, 6, 1, 23) / 1_000,
      logicalSizeBytes: 3n,
      endSectorExclusive: 12n,
    }),
  ],
  asOfTimestamp,
)

expect(result.points.map((point) => point.date)).toEqual([
  "2026-07-01",
  "2026-07-02",
  "2026-07-03",
  "2026-07-04",
])
expect(result.points[2]).toMatchObject({
  dailySubmissionCount: 1n,
  cumulativeLogicalBytes: 8n,
  allocatedSectorCount: 40n,
  allocatedBytes: 10_240n,
})
```

- [x] **Step 2: Run tests and observe failure**

```bash
corepack pnpm test src/analytics/build-storage-timeline.test.ts
```

Expected: FAIL because the analytics module does not exist.

- [x] **Step 3: Implement domain types and pure aggregation**

Define:

```ts
export type AnalyticsRange = "7d" | "30d" | "all"

export interface StorageTimelinePoint {
  readonly date: string
  readonly dailySubmissionCount: bigint
  readonly dailyLogicalBytes: bigint
  readonly cumulativeSubmissionCount: bigint
  readonly cumulativeLogicalBytes: bigint
  readonly allocatedSectorCount: bigint
  readonly allocatedBytes: bigint
}

export interface StorageAnalyticsTimeline {
  readonly points: readonly StorageTimelinePoint[]
  readonly firstSubmissionDate?: string
  readonly asOfDate: string
}
```

Implement `buildStorageTimeline(submissions, asOfTimestamp = Math.floor(Date.now() / 1000))` and
`selectTimelineRange(timeline, range)`. Validate finite non-negative timestamps, use UTC date keys,
fill every calendar day, and multiply the running maximum sector by `STORAGE_SECTOR_BYTES`.

- [x] **Step 4: Run focused tests**

```bash
corepack pnpm test src/analytics/build-storage-timeline.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/analytics
git commit -m "feat: aggregate indexed storage timeline"
```

## Task 3: Expose Analytics Through StorageDataSource

**Files:**
- Modify: `src/data/indexed-db/storage-db.ts`
- Modify: `src/data/storage-data-source.ts`
- Modify: `src/data/fixture-data-source.ts`
- Modify: `src/data/live-rpc-data-source.ts`
- Modify: `src/data/queries.ts`
- Modify: `src/test/browser-fixture-data-source.ts`
- Test: `src/data/storage-data-source.test.ts`
- Test: `src/data/queries.test.ts`

- [x] **Step 1: Write failing data-source contract tests**

Assert fixture/live parity with a fixed clock and spy on the live transport/client:

```ts
const timeline = await source.getAnalyticsTimeline(Date.UTC(2026, 6, 4) / 1_000)
expect(timeline.points.at(-1)?.cumulativeSubmissionCount).toBe(2n)
expect(transport.getSubmitLogs).not.toHaveBeenCalled()
expect(client.readContract).not.toHaveBeenCalled()
```

Also assert analytics invalidation is included in `invalidateStorageAfterSync`.

- [x] **Step 2: Verify failure**

```bash
corepack pnpm test src/data/storage-data-source.test.ts src/data/queries.test.ts
```

Expected: FAIL because the analytics contract and query key do not exist.

- [x] **Step 3: Add repository and data-source methods**

Add:

```ts
interface StorageRepository {
  listAll(): Promise<readonly StorageSubmission[]>
}

interface StorageDataSource {
  getAnalyticsTimeline(asOfTimestamp?: number): Promise<StorageAnalyticsTimeline>
}
```

`IndexedDbStorageRepository.listAll()` must use `getAll("submissions")` and convert persisted rows.
The fixture source aggregates its in-memory canonical submissions; the live source aggregates
`repository.listAll()` through `guardLocalIndex`. Extend `guardedRepository` and
`BrowserFixtureDataSource` so interface parity remains complete.

- [x] **Step 4: Add TanStack Query support**

Add:

```ts
analytics: () => [...storageKeys.all, "analytics"] as const
```

and a query option whose function calls `dataSource.getAnalyticsTimeline()`. Invalidate this key
after every successful sync/rebuild along with summary and submission keys.

- [x] **Step 5: Run focused tests**

```bash
corepack pnpm test src/data src/analytics
corepack pnpm typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/data src/test/browser-fixture-data-source.ts src/analytics
git commit -m "feat: expose storage analytics data source"
```

## Task 4: Add Accessible Chart Components

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/components/charts/chart-format.ts`
- Create: `src/components/charts/chart-data-table.tsx`
- Create: `src/components/charts/storage-growth-chart.tsx`
- Create: `src/components/charts/submission-activity-chart.tsx`
- Test: `src/components/charts/charts.test.tsx`
- Modify: `src/test/setup.ts`

- [x] **Step 1: Install the latest stable Recharts**

```bash
corepack pnpm add recharts@latest
```

Confirm `package.json` and `pnpm-lock.yaml` pin the resolved version.

- [x] **Step 2: Write failing semantic chart tests**

Render each chart with two timeline points and assert visible heading/summary/legend plus a named
table:

```ts
expect(screen.getByRole("heading", { name: "Indexed storage growth" })).toBeInTheDocument()
expect(screen.getByRole("table", { name: "Indexed storage growth daily values" })).toBeInTheDocument()
expect(screen.getByText("Logical data")).toBeInTheDocument()
expect(screen.getByText("Allocated storage")).toBeInTheDocument()
```

Assert the activity chart has “Daily submissions” and “Cumulative submissions” semantics and that
neither component renders mining, reward, Gas, download, or a non-zero fee.

- [x] **Step 3: Verify failure**

```bash
corepack pnpm test src/components/charts
```

Expected: FAIL because the chart components do not exist.

- [x] **Step 4: Implement format and accessibility helpers**

`chart-format.ts` must convert bytes into finite MiB/GiB/TiB coordinates without discarding the
original `bigint`, format UTC dates, and calculate utilization with a zero-allocation guard.

`ChartDataTable` must use semantic `<table>`, `<caption>`, `<time dateTime>`, and formatted exact
values. It may be visually collapsed behind a “View daily values” disclosure, but it must remain
keyboard and screen-reader accessible.

- [x] **Step 5: Implement Recharts components**

Use `ResponsiveContainer`, `LineChart`, `BarChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`,
`Legend`, `Line`, and `Bar`. Set stable container heights, `accessibilityLayer`, explicit series
names, Conflux palette colors, and `isAnimationActive={false}` when reduced motion is requested.

- [x] **Step 6: Run focused tests and typecheck**

```bash
corepack pnpm test src/components/charts
corepack pnpm typecheck
```

Expected: PASS without ResizeObserver or zero-size chart errors. Add a minimal test-only
`ResizeObserver` stub in `src/test/setup.ts` only if Recharts requires it.

- [x] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/charts src/test/setup.ts
git commit -m "feat: add accessible storage charts"
```

## Task 5: Add Dashboard Preview Cards

**Files:**
- Create: `src/features/analytics/analytics-preview-cards.tsx`
- Modify: `src/features/dashboard/dashboard-page.tsx`
- Test: `src/features/dashboard/dashboard-page.test.tsx`
- Modify: `src/test/render.tsx`

- [x] **Step 1: Write failing dashboard tests**

Assert the two linked cards appear before the recent table:

```ts
const storageLink = await screen.findByRole("link", { name: /view storage growth analytics/i })
expect(storageLink).toHaveAttribute("href", "/analytics?metric=storage&range=all")
expect(screen.getByRole("link", { name: /view submission activity analytics/i }))
  .toHaveAttribute("href", "/analytics?metric=submissions&range=all")
expect(storageLink.compareDocumentPosition(screen.getByRole("table", { name: /recent submissions/i }))
  & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
```

Add empty/loading assertions using a stub `StorageDataSource`.

- [x] **Step 2: Verify failure**

```bash
corepack pnpm test src/features/dashboard
```

Expected: FAIL because preview cards are absent.

- [x] **Step 3: Implement previews**

`DashboardPage` reads `queries.analytics()` once. `AnalyticsPreviewCards` renders:

- storage latest allocated value and utilization;
- submission cumulative count;
- full-history charts without full axis detail;
- linked cards with visible “View analytics” affordances;
- fixed-height skeletons and a clean no-history state.

Add the analytics route placeholder to the memory router in `src/test/render.tsx` so generated links
are type-safe in tests.

- [x] **Step 4: Run focused tests**

```bash
corepack pnpm test src/features/dashboard src/components/charts
corepack pnpm typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/features/analytics/analytics-preview-cards.tsx src/features/dashboard src/test/render.tsx
git commit -m "feat: add dashboard analytics previews"
```

## Task 6: Add the Analytics Route and Detail Page

**Files:**
- Modify: `src/routes/-route-validation.ts`
- Test: `src/routes/-route-validation.test.ts`
- Create: `src/routes/analytics.tsx`
- Create: `src/features/analytics/analytics-page.tsx`
- Create: `src/features/analytics/analytics-page.test.tsx`
- Modify: `src/test/render.tsx`
- Generated: `src/routeTree.gen.ts`

- [x] **Step 1: Write failing route validation tests**

Create or extend route validation tests:

```ts
expect(normalizeAnalyticsMetric("submissions")).toBe("submissions")
expect(normalizeAnalyticsMetric("other")).toBe("storage")
expect(normalizeAnalyticsRange("30d")).toBe("30d")
expect(normalizeAnalyticsRange("90d")).toBe("all")
```

- [x] **Step 2: Write failing page tests**

Render `/analytics?metric=submissions&range=7d` and assert:

- heading `Storage analytics`;
- both chart headings;
- `7D` selected;
- range click updates URL to `range=30d`;
- submissions section receives initial focus;
- no analytics link appears in the global primary navigation.

- [x] **Step 3: Verify failure**

```bash
corepack pnpm test src/routes src/features/analytics
```

Expected: FAIL because route helpers/page do not exist.

- [x] **Step 4: Implement route and page**

Use:

```ts
validateSearch: (search: Record<string, unknown>) => ({
  metric: normalizeAnalyticsMetric(search.metric),
  range: normalizeAnalyticsRange(search.range),
})
```

The page obtains the full analytics timeline, applies `selectTimelineRange`, renders sync/recovery
state, and writes both `metric` and `range` on every range navigation. Move focus without smooth
scroll when reduced motion is active.

- [x] **Step 5: Regenerate and test**

```bash
corepack pnpm exec vite build
corepack pnpm test src/routes src/features/analytics
corepack pnpm typecheck
```

Expected: generated route tree contains `/analytics`; tests pass.

- [x] **Step 6: Commit**

```bash
git add src/routes src/routeTree.gen.ts src/features/analytics src/test/render.tsx
git commit -m "feat: add storage analytics page"
```

## Task 7: Apply Conflux Styling and Responsive Behavior

**Files:**
- Modify: `src/styles/index.css`
- Test: `tests/e2e/explorer.spec.ts`
- Test: `tests/e2e/mobile.spec.ts`

- [x] **Step 1: Add failing browser flows**

Desktop flow:

```ts
await page.goto("/")
await page.getByRole("link", { name: /view storage growth analytics/i }).click()
await expect(page).toHaveURL(/\/analytics\?metric=storage&range=all/)
await page.getByRole("button", { name: "30D" }).click()
await expect(page).toHaveURL(/metric=storage&range=30d/)
await page.goBack()
await expect(page).toHaveURL(/range=all/)
```

Mobile flow must assert both preview cards and the analytics page fit without horizontal overflow.

- [x] **Step 2: Run browser tests and observe style/flow failures**

```bash
corepack pnpm test:e2e --grep "analytics"
```

Expected: FAIL before the styles and complete route behavior are present.

- [x] **Step 3: Implement styles**

Add focused classes for:

- `.analytics-preview-grid` and `.analytics-preview-card`;
- `.chart-shell`, `.chart-canvas`, `.chart-summary`, `.chart-legend`;
- `.analytics-range-control`;
- `.analytics-detail-grid`;
- tooltip and accessible daily table;
- fixed loading heights;
- 1024px and 390px adaptations;
- `@media (prefers-reduced-motion: reduce)`.

Use only existing exact palette tokens. Do not add gradients, dark theme, copied ConfluxScan layout,
or color-only series labels.

- [x] **Step 4: Run E2E at desktop/mobile**

```bash
corepack pnpm test:e2e
```

Expected: PASS with no horizontal overflow.

- [x] **Step 5: Commit**

```bash
git add src/styles/index.css tests/e2e
git commit -m "style: polish responsive storage analytics"
```

## Task 8: Documentation and Final Delivery

**Files:**
- Modify: `README.md`
- Modify: this plan checkboxes as tasks complete

- [x] **Step 1: Update README**

Document:

- `/analytics`;
- the `metric` and `range` URL parameters;
- charts derive only from the local canonical index;
- chart reads add no RPC methods or server cache;
- UTC daily semantics.

- [x] **Step 2: Run focused deterministic suites**

```bash
corepack pnpm test src/analytics src/data src/components/charts src/features/analytics src/features/dashboard src/routes
```

Expected: PASS.

- [x] **Step 3: Run the full local quality gate**

```bash
corepack pnpm verify
corepack pnpm test:e2e
```

Expected: PASS.

- [x] **Step 4: Run the explicit read-only live probe**

```bash
corepack pnpm harness:probe
```

Expected: chain ID 71, verified FixedPriceFlow deployment, complete canonical submission count, and
no captured fixture write.

- [x] **Step 5: Inspect the browser**

Inspect 1440px, 1024px, and 390px. Confirm focus, tooltip bounds, partial/stale cached display,
direct `/analytics` refresh, and absence of forbidden product concepts.

- [x] **Step 6: Commit final documentation**

```bash
git add README.md docs/superpowers/plans/2026-07-28-storage-analytics-charts.md
git commit -m "docs: document storage analytics"
```

- [x] **Step 7: Push the functional branch**

```bash
git push -u origin codex/storage-analytics-charts
```

- [x] **Step 8: Merge only after all gates pass**

```bash
git switch master
git pull --ff-only origin master
git merge --no-ff codex/storage-analytics-charts -m "merge: add storage analytics charts"
git push origin master
```

- [x] **Step 9: Verify clean delivery**

```bash
git status --short --branch
git log -5 --oneline --decorate
```

Expected: clean `master`, synchronized with `origin/master`.

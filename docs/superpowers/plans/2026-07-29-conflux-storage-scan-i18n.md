# Conflux Storage Scan Internationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete `en-US` and `zh-CN` localization with browser-language detection, a persistent Footer selector, localized RainbowKit, and locale-aware explorer formatting.

**Architecture:** A single i18next instance initializes before React with TypeScript resources split into five namespaces. `react-i18next` updates components in place; `i18next-browser-languagedetector` checks the app-specific localStorage key before browser languages. UI components translate their own accessible copy, while shared formatter functions receive the active locale and chain data remains unchanged.

**Tech Stack:** React 19, TypeScript 5.9, i18next 26.3.6, react-i18next 17.0.11, i18next-browser-languagedetector 8.2.1, Vitest, Testing Library, Playwright.

---

### Task 1: Install and initialize the internationalization runtime

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/i18n/resources/en-US.ts`
- Create: `src/i18n/resources/zh-CN.ts`
- Create: `src/i18n/i18n.ts`
- Create: `src/i18n/i18n.test.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Add the failing initialization tests**

Create isolated i18next instances in `src/i18n/i18n.test.ts` and assert:

```ts
expect(instance.options.supportedLngs).toEqual(expect.arrayContaining(["en-US", "zh-CN"]))
expect(instance.options.fallbackLng).toEqual(["en-US"])
expect(instance.t("common:nav.overview", { lng: "en-US" })).toBe("Overview")
expect(instance.t("common:nav.overview", { lng: "zh-CN" })).toBe("概览")
expect(Object.keys(english.common).sort()).toEqual(Object.keys(chinese.common).sort())
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
corepack pnpm test src/i18n/i18n.test.ts
```

Expected: FAIL because the i18n modules and dependencies do not exist.

- [ ] **Step 3: Install pinned dependencies**

Run:

```bash
corepack pnpm add i18next@26.3.6 react-i18next@17.0.11 i18next-browser-languagedetector@8.2.1
```

- [ ] **Step 4: Implement the i18next instance**

`src/i18n/i18n.ts` must export the initialized singleton and a factory for isolated tests:

```ts
export const supportedLanguages = ["en-US", "zh-CN"] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]
export const LANGUAGE_STORAGE_KEY = "conflux-storage-scan-language"

export function createI18nInstance() {
  return createInstance()
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      supportedLngs: supportedLanguages,
      fallbackLng: "en-US",
      defaultNS: "common",
      ns: ["common", "explorer", "analytics", "errors", "wallet"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      },
    })
}
```

The production export must await initialization before `createRoot(...).render(...)`. Register a
`languageChanged` listener that sets `document.documentElement.lang` to the resolved supported
language.

- [ ] **Step 5: Add complete English and Chinese resource skeletons**

Both resource modules export the same five namespaces. Task 1 adds `common.nav.overview`,
`common.nav.submissions`, `common.nav.mySubmissions`, `common.footer.network`,
`common.footer.description`, `common.footer.language`, `common.actions.search`,
`common.actions.retry`, `common.actions.previous` and `common.actions.next`. Tasks 3–5 extend the
same typed resource objects with their explicitly listed component copy.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
corepack pnpm test src/i18n/i18n.test.ts
```

Expected: all i18n initialization and resource-parity tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/i18n src/main.tsx
git commit -m "feat: initialize bilingual i18n runtime"
```

### Task 2: Localize shared formatting

**Files:**
- Modify: `src/components/format.ts`
- Modify: `src/components/components.test.tsx`
- Modify: `src/components/charts/chart-format.ts`
- Modify: `src/components/charts/chart-format.test.ts`

- [ ] **Step 1: Add failing locale-format tests**

Add assertions that prove language is used:

```ts
expect(formatInteger(12_345n, "en-US")).toBe("12,345")
expect(formatInteger(12_345n, "zh-CN")).toBe("12,345")
expect(formatRelativeTime(now / 1_000 - 3_600, now, "en-US")).toBe("1 hour ago")
expect(formatRelativeTime(now / 1_000 - 3_600, now, "zh-CN")).toBe("1小时前")
expect(formatUtcDate("2026-07-28", "en-US")).toBe("Jul 28, 2026")
expect(formatUtcDate("2026-07-28", "zh-CN")).toBe("2026年7月28日")
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
corepack pnpm test src/components/components.test.tsx src/components/charts/chart-format.test.ts
```

Expected: FAIL because the formatters do not accept a locale and are hard-coded to English.

- [ ] **Step 3: Add explicit locale parameters**

Change formatter signatures to:

```ts
formatInteger(value: bigint | number, locale?: string): string
formatBytes(value: bigint, locale?: string): string
formatRelativeTime(timestampSeconds: number, now?: number, locale?: string): string
formatUtcDate(date: string, locale?: string): string
formatUtcCompactDate(date: string, locale?: string): string
```

Use `Intl.NumberFormat`, `Intl.RelativeTimeFormat`, and `Intl.DateTimeFormat` with the supplied
locale. Keep UTC chart semantics and IEC units unchanged.

- [ ] **Step 4: Run and verify GREEN**

Run the same focused command and expect all formatter tests to pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/format.ts src/components/components.test.tsx src/components/charts
git commit -m "feat: localize explorer value formatting"
```

### Task 3: Add the Footer selector and localize the shared application shell

**Files:**
- Create: `src/components/language-select.tsx`
- Create: `src/components/language-select.test.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/app-header.tsx`
- Modify: `src/components/copy-button.tsx`
- Modify: `src/components/data-state.tsx`
- Modify: `src/components/pagination.tsx`
- Modify: `src/components/submission-table.tsx`
- Modify: `src/components/sync-status.tsx`
- Modify: `src/features/search/global-search.tsx`
- Modify: `src/features/search/global-search.test.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Add failing selector behavior tests**

Render the component with an isolated i18next instance and assert:

```ts
expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en-US")
await user.selectOptions(screen.getByRole("combobox"), "zh-CN")
expect(screen.getByRole("combobox", { name: "语言" })).toHaveValue("zh-CN")
expect(document.documentElement.lang).toBe("zh-CN")
expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh-CN")
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
corepack pnpm test src/components/language-select.test.tsx src/features/search/global-search.test.tsx
```

Expected: FAIL because the language selector does not exist and shared copy is English-only.

- [ ] **Step 3: Implement the selector**

Use a native labeled control:

```tsx
<div className="language-select">
  <label htmlFor={id}>{t("footer.language")}</label>
  <select
    id={id}
    name="language"
    onChange={(event) => void i18n.changeLanguage(event.target.value)}
    value={resolvedLanguage}
  >
    <option value="zh-CN">中文（简体）</option>
    <option value="en-US">English</option>
  </select>
</div>
```

- [ ] **Step 4: Synchronize RainbowKit**

Inside the provider tree, subscribe with `useTranslation` and pass `zh-CN` or `en-US` to
`RainbowKitProvider`. Do not recreate the Query Client, wagmi config, data source, or router.

- [ ] **Step 5: Migrate shared shell copy**

Replace literal user-facing copy in the listed components with namespaced translation calls,
including ARIA labels, titles, captions, search validation, pagination, copy success, sync status,
loading notices, route errors and Footer content.

Map stable sync error codes to `errors` keys and render the code next to the localized description.
Unknown codes use `errors:codes.unknown`.

- [ ] **Step 6: Add responsive Footer styling**

Keep network/read-only copy on the left and selector on the right. At narrow widths, allow wrapping
and keep the select at least 9rem wide with a visible focus state.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
corepack pnpm test src/components src/features/search
```

- [ ] **Step 8: Commit**

```bash
git add src/app/providers.tsx src/routes/__root.tsx src/components src/features/search src/styles/index.css
git commit -m "feat: add persistent footer language selector"
```

### Task 4: Translate explorer routes and wallet states

**Files:**
- Modify: `src/features/dashboard/dashboard-page.tsx`
- Modify: `src/features/dashboard/dashboard-page.test.tsx`
- Modify: `src/features/submissions/submissions-page.tsx`
- Modify: `src/features/submissions/submissions-page.test.tsx`
- Modify: `src/features/address/address-page.tsx`
- Modify: `src/features/address/address-page.test.tsx`
- Modify: `src/features/submission-detail/submission-detail-page.tsx`
- Modify: `src/features/submission-detail/submission-detail-page.test.tsx`
- Modify: `src/features/wallet-history/wallet-history-page.tsx`
- Modify: `src/features/wallet-history/wallet-history-page.test.tsx`
- Modify: `src/features/recovery/rebuild-index-button.tsx`
- Modify: `src/features/recovery/recovery.test.tsx`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`

- [ ] **Step 1: Add one failing Chinese behavior assertion per route**

Switch the isolated test i18n instance to `zh-CN` and assert representative accessible content:

```ts
expect(await screen.findByRole("heading", { name: "存储概览" })).toBeInTheDocument()
expect(await screen.findByRole("columnheader", { name: "序号" })).toBeInTheDocument()
expect(await screen.findByRole("heading", { name: "提交 #7" })).toBeInTheDocument()
expect(screen.getByText("存储费用")).toBeInTheDocument()
expect(screen.getByText("0 CFX")).toBeInTheDocument()
```

- [ ] **Step 2: Run affected feature tests and verify RED**

Run:

```bash
corepack pnpm test src/features/dashboard src/features/submissions src/features/address src/features/submission-detail src/features/wallet-history src/features/recovery
```

- [ ] **Step 3: Migrate route copy**

Use `useTranslation(["common", "explorer", "errors", "wallet"])` in each route. Translate headings,
labels, descriptions, empty/loading states, captions, copy labels and rebuild confirmation. Pass
`i18n.resolvedLanguage` to all formatters.

Use i18next `count` options for submissions/events and interpolation for sequence, address, page and
index-count messages.

- [ ] **Step 4: Run affected tests and verify GREEN**

Run the same feature command and expect all English and Chinese assertions to pass.

- [ ] **Step 5: Commit**

```bash
git add src/features src/i18n/resources
git commit -m "feat: translate explorer routes and wallet states"
```

### Task 5: Translate analytics and accessible chart content

**Files:**
- Modify: `src/features/analytics/analytics-page.tsx`
- Modify: `src/features/analytics/analytics-preview-cards.tsx`
- Modify: `src/features/analytics/analytics-page.test.tsx`
- Modify: `src/components/charts/storage-growth-chart.tsx`
- Modify: `src/components/charts/submission-activity-chart.tsx`
- Modify: `src/components/charts/chart-data-table.tsx`
- Modify: `src/components/charts/charts.test.tsx`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`

- [ ] **Step 1: Add failing Chinese chart tests**

Assert visible and accessible chart content:

```ts
expect(screen.getByRole("heading", { name: "已索引存储增长" })).toBeInTheDocument()
expect(screen.getByRole("region", { name: /存储增长图表/ })).toBeInTheDocument()
expect(screen.getByText("每日提交")).toBeInTheDocument()
expect(screen.getByText("查看每日数据")).toBeInTheDocument()
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
corepack pnpm test src/components/charts src/features/analytics
```

- [ ] **Step 3: Localize charts**

Translate headings, summaries, legend names, Tooltip values, range labels, ARIA regions, captions
and table headers. Pass the active locale into UTC date, byte and integer formatters. Keep Recharts
series data keys stable and translate only their displayed `name`.

- [ ] **Step 4: Run and verify GREEN**

Run the same focused test command.

- [ ] **Step 5: Commit**

```bash
git add src/components/charts src/features/analytics src/i18n/resources
git commit -m "feat: translate storage analytics"
```

### Task 6: Add end-to-end language coverage and finish the branch

**Files:**
- Create: `tests/e2e/localization.spec.ts`
- Modify: `tests/e2e/explorer.spec.ts`
- Modify: `tests/e2e/mobile.spec.ts`

- [ ] **Step 1: Add failing E2E coverage**

The new tests must:

```ts
test.use({ locale: "zh-CN" })

test("browser locale selects Chinese and a saved English choice survives reload", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "存储概览" })).toBeVisible()
  const language = page.getByRole("combobox", { name: "语言" })
  const originalUrl = page.url()
  await language.selectOption("en-US")
  await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
  expect(page.url()).toBe(originalUrl)
  await page.reload()
  await expect(page.getByRole("combobox", { name: "Language" })).toHaveValue("en-US")
})
```

Add a second test that navigates the Chinese submissions, detail, address, analytics and disconnected
wallet routes and checks representative headings without any RPC request caused by language change.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
corepack pnpm test:e2e --grep "browser locale selects Chinese"
```

- [ ] **Step 3: Run a literal-copy inventory and close every UI finding**

Run:

```bash
rg -n '>[A-Za-z][^<{]*<|aria-label=\"[A-Za-z]|title=\"[A-Za-z]|placeholder=\"[A-Za-z]' src \
  --glob '*.tsx'
```

Classify every match. Move user-visible prose to an existing namespace, or record it as an allowed
technical token from the design (`Conflux Storage Scan`, `Conflux`, `eSpace`, `FixedPriceFlow`,
`Submit`, `CFX`). Do not change route/data behavior. Ensure existing English tests explicitly set
`en-US` so the browser-locale test cannot make the suite order-dependent.

- [ ] **Step 4: Run focused and complete quality gates**

Run:

```bash
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm test:e2e
git diff --check
```

- [ ] **Step 5: Inspect real browser layouts**

Use fixture mode and inspect `/`, `/submissions`, `/submission/484`, `/analytics` and `/history` in
both languages at 1440px, 1024px and 390px. Confirm Header, Footer, native select, tables, charts,
long Chinese error text and mobile navigation have no horizontal overflow. Confirm no console errors.

- [ ] **Step 6: Review against Web Interface Guidelines**

Fetch the latest guidelines, audit all changed UI files, and resolve any new finding with a failing
regression test.

- [ ] **Step 7: Commit final E2E and compatibility changes**

```bash
git add tests/e2e src
git commit -m "test: cover bilingual explorer flows"
```

- [ ] **Step 8: Push, merge and re-verify**

```bash
git push -u origin codex/add-chinese-localization
git switch master
git pull --ff-only origin master
git merge --no-ff codex/add-chinese-localization -m "merge: add Chinese localization"
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm test:e2e
git push origin master
```

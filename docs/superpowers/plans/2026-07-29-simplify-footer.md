# Simplified Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Footer resource links and place the read-only status and language selector on one responsive control row.

**Architecture:** Keep `AppFooter` presentation-only and preserve the existing `LanguageSelect` component. Replace the resource navigation row with a compact control row, keep the complete Footer on one row at desktop and tablet widths, stack only the identity and control groups on mobile, remove now-unused translations and link styles, and lock the 1440px/1024px/390px geometry with Playwright.

**Tech Stack:** React 19, TypeScript 5.9, i18next, CSS Flexbox, Vitest, Testing Library, Playwright.

---

### Task 1: Reduce Footer to product identity and one control row

**Files:**
- Modify: `src/test/smoke.test.tsx`
- Modify: `tests/e2e/localization.spec.ts`
- Modify: `src/components/app-footer.tsx`
- Modify: `src/i18n/resources/en-US.ts`
- Modify: `src/i18n/resources/zh-CN.ts`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write the failing component regression**

Update the smoke test so the Footer assertions require:

```ts
const footer = screen.getByRole("contentinfo")
expect(footer).toHaveTextContent("Read-only explorer for FixedPriceFlow storage submissions.")
expect(within(footer).getByText("Conflux Storage Scan")).toHaveAttribute("translate", "no")
expect(within(footer).getByRole("combobox", { name: "Language" })).toBeInTheDocument()
expect(within(footer).queryByRole("link")).not.toBeInTheDocument()

const controls = footer.querySelector(".app-footer__controls")
expect(controls).toContainElement(within(footer).getByText("Read-only", { exact: true }))
expect(controls).toContainElement(within(footer).getByRole("combobox", { name: "Language" }))
```

This replaces all expectations that the testnet, contract, and GitHub Footer links exist.

- [ ] **Step 2: Write the failing responsive geometry regression**

Add localization Playwright tests that:

- at widths `1440` and `1024`, align the product name, description, read-only status, language label,
  and language selector on one row;
- at width `390`, keep the read-only status and language selector on one row while allowing the
  product identity group to occupy the preceding row.

For the mobile control-row assertion:

```ts
const footer = page.getByRole("contentinfo")
const readOnly = footer.getByText("只读", { exact: true })
const language = footer.getByRole("combobox", { name: "语言" })

await footer.scrollIntoViewIfNeeded()
const [footerBox, readOnlyBox, languageBox] = await Promise.all([
	footer.boundingBox(),
	readOnly.boundingBox(),
	language.boundingBox(),
])

expect(Math.abs(
	(readOnlyBox!.y + readOnlyBox!.height / 2) -
	(languageBox!.y + languageBox!.height / 2),
)).toBeLessThanOrEqual(1)
expect(readOnlyBox!.x).toBeGreaterThanOrEqual(footerBox!.x)
expect(languageBox!.x + languageBox!.width).toBeLessThanOrEqual(footerBox!.x + footerBox!.width)
expect(await footer.getByRole("link").count()).toBe(0)
```

Also assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
corepack pnpm test src/test/smoke.test.tsx
corepack pnpm exec playwright test tests/e2e/localization.spec.ts --grep "keeps read-only status and language"
```

Expected: the component test fails because the three links still exist and `.app-footer__controls`
does not; the browser test fails because the current mobile rule stacks the status and language
selector.

- [ ] **Step 4: Simplify `AppFooter`**

Remove `ExternalLink`, `CONTRACT_URL`, `SOURCE_URL`, and the resource `<nav>`. Render exactly:

```tsx
<footer className="app-footer">
	<div className="app-container app-footer__inner">
		<div className="app-footer__identity">
			<strong translate="no">Conflux Storage Scan</strong>
			<p>{t("footer.description")}</p>
		</div>
		<div className="app-footer__controls">
			<span className="app-footer__readonly">
				<span aria-hidden="true" />
				{t("footer.readOnly")}
			</span>
			<LanguageSelect />
		</div>
	</div>
</footer>
```

- [ ] **Step 5: Remove unused translations and link styles**

Delete `footer.contract`, `footer.network`, `footer.resourcesAria`, and `footer.source` from both
translation resources. Rename `.app-footer__resources` to `.app-footer__controls`, keep
`display: flex`, `align-items: center`, `justify-content: space-between`, and remove the top border,
resource navigation, and link rules. Use a horizontal Flex layout for `.app-footer__inner` at
desktop and tablet widths; keep the identity group on one line and truncate its description when
space is constrained. At mobile width, stack the identity and control groups, restore natural
description wrapping, and do not apply `flex-direction: column` to the control row.

- [ ] **Step 6: Run focused and affected tests**

Run:

```bash
corepack pnpm test src/test/smoke.test.tsx src/components/language-select.test.tsx
corepack pnpm exec playwright test tests/e2e/localization.spec.ts
```

Expected: all Footer and localization tests pass; language selection and its popup behavior remain
unchanged.

- [ ] **Step 7: Run UI and project gates**

Run:

```bash
corepack pnpm verify:ui
```

Expected: Harness validation, Biome, typecheck, all unit tests, production build, and all Playwright
tests pass. Existing unrelated working-tree changes must remain unstaged and absent from the Footer
commit.

- [ ] **Step 8: Commit, push, merge, and re-verify**

Stage only the six files listed in this task and the plan:

```bash
git add docs/superpowers/plans/2026-07-29-simplify-footer.md src/test/smoke.test.tsx tests/e2e/localization.spec.ts src/components/app-footer.tsx src/i18n/resources/en-US.ts src/i18n/resources/zh-CN.ts src/styles/index.css
git commit -m "refactor: simplify explorer footer"
git push -u origin codex/simplify-footer
git switch master
git merge --ff-only codex/simplify-footer
corepack pnpm verify:ui
git push origin master
```

Expected: `origin/codex/simplify-footer` and `origin/master` contain the simplified Footer, while
the unrelated Harness working-tree edits remain uncommitted and unchanged.

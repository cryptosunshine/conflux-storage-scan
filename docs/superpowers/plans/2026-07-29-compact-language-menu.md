# Compact Language Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep both footer language options on one line and reduce the Radix popup’s typography and visual density without changing language behavior.

**Architecture:** Preserve the existing `LanguageSelect` component and i18next integration. Add a browser regression that measures the real portaled menu at desktop, tablet, and mobile widths, then fix the Portal inheritance gap with explicit popup CSS. No React, route, RPC, wallet, or data-source changes are required.

**Tech Stack:** React 19, TypeScript 5.9, Radix Select 2.3.7, CSS custom properties, Playwright.

---

### Task 1: Make the portaled language menu compact and single-line

**Files:**
- Modify: `tests/e2e/localization.spec.ts`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Add the failing browser regression**

Inside `keeps the language menu inside desktop, tablet, and mobile viewports`, immediately after
the menu opens, add:

```ts
const chineseOption = page.getByRole("option", { name: "中文（简体）" })
await expect(chineseOption).toBeVisible()

const menuMetrics = await chineseOption.evaluate((option) => {
	const text = option.querySelector("span")
	if (!(text instanceof HTMLElement) || text.textContent !== "中文（简体）") {
		throw new Error("Language option text is missing")
	}

	const style = getComputedStyle(option)
	const range = document.createRange()
	range.selectNodeContents(text)
	const lineTops = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)))

	return {
		fontSize: style.fontSize,
		height: option.getBoundingClientRect().height,
		lineCount: lineTops.size,
		whiteSpace: style.whiteSpace,
	}
})

expect(menuMetrics.fontSize).toBe("13px")
expect(menuMetrics.whiteSpace).toBe("nowrap")
expect(menuMetrics.lineCount).toBe(1)
expect(menuMetrics.height).toBeLessThanOrEqual(36)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm exec playwright test tests/e2e/localization.spec.ts --grep "keeps the language menu"
```

Expected: FAIL because the portaled menu currently computes to `16px`, uses `white-space: normal`,
and the Chinese option occupies more than one line.

- [ ] **Step 3: Add explicit compact popup styles**

Update the language popup rules in `src/styles/index.css` to:

```css
.language-select__content {
	z-index: 200;
	width: var(--radix-select-trigger-width);
	max-width: calc(100vw - 2rem);
	overflow: hidden;
	border: 1px solid var(--color-border);
	border-radius: 0.65rem;
	color: var(--color-text);
	background: var(--color-surface-raised);
	box-shadow: var(--shadow-popover);
	font-size: 0.8125rem;
	line-height: 1.25rem;
	transform-origin: var(--radix-select-content-transform-origin);
	animation: language-select-open 120ms ease-out;
}

.language-select__viewport {
	padding: 0.25rem;
}

.language-select__item {
	position: relative;
	display: flex;
	min-height: 2.25rem;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 0.375rem 0.55rem;
	border-radius: 0.4rem;
	color: var(--color-text);
	white-space: nowrap;
	outline: 0;
	cursor: pointer;
	user-select: none;
}

.language-select__item[data-highlighted] {
	color: var(--color-primary-strong);
	background: color-mix(
		in srgb,
		var(--color-primary-soft) 62%,
		var(--color-surface-raised)
	);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
corepack pnpm exec playwright test tests/e2e/localization.spec.ts --grep "keeps the language menu"
```

Expected: PASS at 1440px, 1024px, and 390px.

- [ ] **Step 5: Run focused affected suites**

Run:

```bash
corepack pnpm test src/components/language-select.test.tsx
corepack pnpm exec playwright test tests/e2e/localization.spec.ts
```

Expected: the component test and all localization browser tests pass with no warnings.

- [ ] **Step 6: Inspect the real browser**

At 1440px, 1024px, and 390px verify:

- “中文（简体）” and “English” remain on one line.
- The popup opens above the Trigger and stays inside the viewport.
- Trigger dimensions and Footer alignment are unchanged.
- Selected, hovered, keyboard-focused, and Escape-to-close states remain visible and usable.
- There is no horizontal overflow or browser console error.

- [ ] **Step 7: Run complete project gates**

Run:

```bash
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm test:e2e
```

Expected: Harness validation, Biome, typecheck, unit tests, production build, and all Playwright
tests pass. The existing Vite bundle-size warning is non-blocking if unchanged.

- [ ] **Step 8: Commit, push, and merge**

Run:

```bash
git add tests/e2e/localization.spec.ts src/styles/index.css
git commit -m "fix: keep language menu options on one line"
git push -u origin codex/refine-language-select-density
git switch master
git merge --ff-only codex/refine-language-select-density
corepack pnpm verify
corepack pnpm test:e2e
git push origin master
```

Expected: the feature branch and `master` are present on `origin`, and the merged state passes the
full local gates.

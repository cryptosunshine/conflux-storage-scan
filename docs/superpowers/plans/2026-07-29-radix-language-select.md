# Radix Language Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Footer native language select with a polished, accessible Radix Select while preserving the existing i18next behavior.

**Architecture:** `LanguageSelect` remains the only component that maps the current i18next language to a supported value. Radix Select supplies the controlled trigger, portal, listbox, option semantics, and keyboard behavior; project CSS supplies the Conflux Light Theme. No route, data-source, RPC, or wallet state changes.

**Tech Stack:** React 19, TypeScript 5.9, `@radix-ui/react-select` 2.3.7, lucide-react, react-i18next, Vitest, Testing Library, Playwright.

---

### Task 1: Replace the native language control with Radix Select

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/components/language-select.test.tsx`
- Modify: `src/components/language-select.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write the failing component test**

Replace the native-selection interaction in `src/components/language-select.test.tsx` with:

```tsx
const language = screen.getByRole("combobox", { name: "Language" })
expect(language).toHaveAttribute("aria-expanded", "false")
expect(language).toHaveTextContent("English")

await user.click(language)
expect(language).toHaveAttribute("aria-expanded", "true")
await user.click(screen.getByRole("option", { name: "中文（简体）" }))

expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("中文（简体）")
expect(document.documentElement.lang).toBe("zh-CN")
expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh-CN")
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
corepack pnpm test src/components/language-select.test.tsx
```

Expected: FAIL because the native `<select>` has no explicit `aria-expanded="false"` trigger state.

- [ ] **Step 3: Install the pinned primitive**

Run:

```bash
corepack pnpm add @radix-ui/react-select@2.3.7
```

Expected: `package.json` and `pnpm-lock.yaml` contain the pinned standalone package.

- [ ] **Step 4: Implement the controlled Radix component**

Replace `src/components/language-select.tsx` with:

```tsx
import * as Select from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import type { SupportedLanguage } from "../i18n/i18n"

function resolvedLanguage(language: string): SupportedLanguage {
	return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
}

export function LanguageSelect() {
	const id = useId()
	const { i18n, t } = useTranslation("common")
	const language = resolvedLanguage(i18n.resolvedLanguage ?? i18n.language)

	return (
		<div className="language-select">
			<label htmlFor={id}>{t("footer.language")}</label>
			<Select.Root onValueChange={(value) => void i18n.changeLanguage(value)} value={language}>
				<Select.Trigger className="language-select__trigger" id={id}>
					<Select.Value />
					<Select.Icon asChild>
						<ChevronDown aria-hidden="true" size={14} />
					</Select.Icon>
				</Select.Trigger>
				<Select.Portal>
					<Select.Content
						align="end"
						className="language-select__content"
						position="popper"
						side="top"
						sideOffset={8}
					>
						<Select.Viewport className="language-select__viewport">
							<Select.Item className="language-select__item" value="zh-CN">
								<Select.ItemText>中文（简体）</Select.ItemText>
								<Select.ItemIndicator asChild>
									<Check aria-hidden="true" size={14} />
								</Select.ItemIndicator>
							</Select.Item>
							<Select.Item className="language-select__item" value="en-US">
								<Select.ItemText>English</Select.ItemText>
								<Select.ItemIndicator asChild>
									<Check aria-hidden="true" size={14} />
								</Select.ItemIndicator>
							</Select.Item>
						</Select.Viewport>
					</Select.Content>
				</Select.Portal>
			</Select.Root>
		</div>
	)
}
```

- [ ] **Step 5: Add the Conflux Light Theme styles**

Replace the native `.language-select select` rules in `src/styles/index.css` with trigger, portal, and
option rules that use:

```css
.language-select__trigger {
	display: inline-flex;
	min-width: 9rem;
	min-height: 2.5rem;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 0.45rem 0.7rem;
	border: 1px solid var(--color-border);
	border-radius: 0.55rem;
	color: var(--color-text-strong);
	background: var(--color-surface);
	font: inherit;
	cursor: pointer;
}

.language-select__trigger:hover,
.language-select__trigger[data-state="open"] {
	border-color: var(--color-accent-muted);
}

.language-select__content {
	z-index: 200;
	width: var(--radix-select-trigger-width);
	max-width: calc(100vw - 2rem);
	overflow: hidden;
	border: 1px solid var(--color-border);
	border-radius: 0.65rem;
	background: var(--color-surface-raised);
	box-shadow: var(--shadow-popover);
	animation: language-select-open 120ms ease-out;
}

.language-select__viewport {
	padding: 0.3rem;
}

.language-select__item {
	position: relative;
	display: flex;
	min-height: 2.5rem;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 0.5rem 0.65rem;
	border-radius: 0.45rem;
	color: var(--color-text);
	outline: 0;
	cursor: pointer;
	user-select: none;
}

.language-select__item[data-highlighted] {
	color: var(--color-primary-strong);
	background: var(--color-primary-soft);
}

@keyframes language-select-open {
	from {
		opacity: 0;
		transform: translateY(0.25rem);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.language-select__content {
		animation: none;
	}
}
```

Retain the existing global `:focus-visible` ring and mobile Footer stacking.

- [ ] **Step 6: Run focused verification and verify GREEN**

Run:

```bash
corepack pnpm test src/components/language-select.test.tsx
corepack pnpm typecheck
corepack pnpm lint
```

Expected: the component test passes and both static checks exit successfully.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/language-select.test.tsx src/components/language-select.tsx src/styles/index.css
git commit -m "feat: upgrade language selector with Radix"
```

### Task 2: Update browser coverage and finish the branch

**Files:**
- Modify: `tests/e2e/localization.spec.ts`

- [ ] **Step 1: Update the E2E interaction for the Radix listbox**

Replace native `selectOption` assertions with:

```ts
const language = page.getByRole("combobox", { name: "语言" })
await expect(language).toContainText("中文（简体）")
await language.click()
await page.getByRole("option", { name: "English" }).click()

await expect(page.getByRole("combobox", { name: "Language" })).toContainText("English")
```

The rest of the test continues to assert unchanged URL, `html[lang]`, localStorage persistence,
reload persistence, and zero live RPC requests.

- [ ] **Step 2: Run focused browser verification**

Run:

```bash
corepack pnpm exec playwright test tests/e2e/localization.spec.ts tests/e2e/mobile.spec.ts
```

Expected: localization and mobile suites pass.

- [ ] **Step 3: Inspect responsive layouts**

With fixture mode, inspect `/` at 1440px, 1024px, and 390px:

- Trigger remains 40px high and aligned with Footer metadata.
- Content opens upward and remains within the viewport.
- Hover, open, selected, and keyboard-focus states are visible.
- The page has no horizontal overflow.
- The browser console has no errors.

- [ ] **Step 4: Run complete gates**

Run:

```bash
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm test:e2e
```

Expected: Harness validation, lint, typecheck, all unit tests, production build, and all Playwright
tests pass.

- [ ] **Step 5: Commit E2E changes**

```bash
git add tests/e2e/localization.spec.ts
git commit -m "test: cover Radix language selection"
```

- [ ] **Step 6: Push and merge**

Push `codex/improve-language-select`, fast-forward merge it into `master`, rerun the complete gates
on the merged state, and push `master` only if every gate passes.

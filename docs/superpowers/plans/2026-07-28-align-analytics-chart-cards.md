# Analytics Preview Card Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two dashboard analytics preview cards share aligned title, plot, legend, and action rows while allowing each summary to use the card's full width.

**Architecture:** Keep the existing chart components and legends, but split each chart header into a title/value row followed by a full-width description row. Give preview cards a shared flex-column layout, a consistent compact header height and chart height, and an action row pinned to the card bottom.

**Tech Stack:** React 19, TypeScript 5.9, Recharts, CSS, Playwright, pnpm 11.

---

## Scope

- Work directly in `codex/align-analytics-chart-cards`; do not create a worktree.
- Preserve chart data, copy, legends, routes, colors, and accessible daily-value tables.
- Do not add RPC requests, dependencies, themes, or unrelated responsive changes.

## UI Thesis

- **Visual thesis:** Present both analytics cards as one calm, precise explorer module whose titles, plots, legends, and actions share a rigorous baseline.
- **Content plan:** Keep the existing title and headline value first, give the explanatory summary a complete second row, then retain the plot, legend, and final analytics link.
- **Interaction thesis:** Preserve the current whole-card link, focus treatment, and restrained hover lift; this fix changes geometry only and introduces no new motion.

## Target Files

- Modify `tests/e2e/explorer.spec.ts` to cover full-width summary text and equal plot/action positions.
- Modify `src/components/charts/storage-growth-chart.tsx` and `src/components/charts/submission-activity-chart.tsx` to expose a shared title/value row.
- Modify `src/styles/index.css` to make summaries full width and preview cards equal-height flex columns.

## Task 1: Add the Visual Regression

- [x] Add a desktop Playwright test that loads `/`, locates both accessible analytics preview links, and asserts:
  - the storage summary occupies one line at the default desktop viewport;
  - both chart canvases have equal top coordinates and heights;
  - both `View analytics` action rows have equal top coordinates.
- [x] Run:

```bash
corepack pnpm test:e2e --grep "align their plots and actions"
```

Expected: FAIL because the storage summary wraps and pushes its plot/action below the activity card.

## Task 2: Implement the Shared Card Geometry

- [x] In each chart component, render:

```tsx
<header className="chart-shell__header">
  <div className="chart-shell__title-row">
    <h2>...</h2>
    <strong>...</strong>
  </div>
  <p>...</p>
</header>
```

- [x] In `src/styles/index.css`:
  - make `.chart-shell__header` a vertical layout;
  - make `.chart-shell__title-row` the title/value flex row;
  - remove the summary width cap;
  - make `.analytics-preview-card` a flex column;
  - give compact headers and canvases consistent heights;
  - pin `.analytics-preview-card__action` with `margin-top: auto`.
- [x] Re-run the focused Playwright test.

Expected: PASS with both preview plots and actions aligned.

## Task 3: Verify and Deliver

- [x] Run:

```bash
corepack pnpm test src/components/charts src/features/dashboard
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm verify
corepack pnpm test:e2e
```

- [x] Inspect `/` at 1440px, 1024px, and 390px in a real browser. Confirm desktop alignment, full-width summary copy, retained legends, visible focus, and no mobile horizontal overflow.
- [ ] Mark this plan complete, commit the scoped files, push `codex/align-analytics-chart-cards`, merge it into `master`, rerun the required gates, and push `master`.

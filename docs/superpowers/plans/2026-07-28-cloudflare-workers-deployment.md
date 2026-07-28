# Cloudflare Workers Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cloudflare Workers Builds deploy the Vite SPA from checked-in, reproducible Wrangler and pnpm configuration without triggering automatic project setup.

**Architecture:** Keep the application as a client-only static Worker with no Worker entry point. Pin Wrangler in the repository, explicitly approve only the `workerd` dependency build script, and configure `dist` with SPA fallback routing.

**Tech Stack:** pnpm 11.17.0, Wrangler 4.114.0, Cloudflare Workers Static Assets, Vite, TanStack Router

---

### Task 1: Reproduce the missing deployment contract

**Files:**
- Inspect: `package.json`
- Expected missing file: `wrangler.jsonc`
- Inspect: `pnpm-workspace.yaml`

- [ ] **Step 1: Run the failing deployment-contract assertion**

```bash
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); assert.equal(fs.existsSync("wrangler.jsonc"), true, "wrangler.jsonc must be checked in"); assert.equal(pkg.devDependencies?.wrangler, "4.114.0", "Wrangler must be pinned")'
```

Expected: FAIL with `wrangler.jsonc must be checked in`.

### Task 2: Add reproducible Wrangler configuration

**Files:**
- Create: `wrangler.jsonc`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the static SPA Wrangler configuration**

```json
{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "conflux-storage-scan",
	"compatibility_date": "2026-07-28",
	"assets": {
		"directory": "./dist",
		"not_found_handling": "single-page-application"
	}
}
```

- [ ] **Step 2: Preserve the existing workspace settings and approve the required dependency build**

```yaml
packages:
  - "."
overrides:
  use-sync-external-store: 1.6.0
allowBuilds:
  bufferutil: false
  esbuild: true
  keccak: true
  msw: false
  utf-8-validate: false
  workerd: true
minimumReleaseAgeExclude:
  - viem@2.55.10
```

- [ ] **Step 3: Pin Wrangler and update the lock file**

```bash
corepack pnpm add --save-dev --save-exact wrangler@4.114.0
```

Expected: installation completes without `ERR_PNPM_IGNORED_BUILDS`; `package.json` contains
`"wrangler": "4.114.0"` and the lock file includes Wrangler and workerd.

- [ ] **Step 4: Run the deployment-contract assertion again**

```bash
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); assert.equal(fs.existsSync("wrangler.jsonc"), true, "wrangler.jsonc must be checked in"); assert.equal(pkg.devDependencies?.wrangler, "4.114.0", "Wrangler must be pinned")'
```

Expected: PASS with exit code 0.

- [ ] **Step 5: Commit the implementation**

```bash
git add wrangler.jsonc pnpm-workspace.yaml package.json pnpm-lock.yaml
git commit -m "fix: configure Cloudflare Workers deployment"
```

### Task 3: Verify local and Cloudflare build contracts

**Files:**
- Verify: `wrangler.jsonc`
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify: `pnpm-workspace.yaml`

- [ ] **Step 1: Verify the frozen lock file**

```bash
corepack pnpm install --frozen-lockfile
```

Expected: exit code 0 with no ignored-build error.

- [ ] **Step 2: Build the production assets**

```bash
corepack pnpm build
```

Expected: Vite writes `dist/index.html` and exits with code 0.

- [ ] **Step 3: Validate Wrangler without deploying**

```bash
corepack pnpm exec wrangler deploy --dry-run
```

Expected: Wrangler recognizes the static assets configuration, completes the dry run, and does
not prompt to install or generate project configuration.

- [ ] **Step 4: Run the full repository verification**

```bash
corepack pnpm verify
```

Expected: lint, typecheck, unit tests, and production build all exit with code 0.

- [ ] **Step 5: Verify browser routes**

```bash
corepack pnpm test:e2e
```

Expected: all configured public and wallet-history browser flows pass.

### Task 4: Publish through the required branch workflow

**Files:**
- Verify: all files in the branch

- [ ] **Step 1: Push the functional branch**

```bash
git push -u origin codex/fix-cloudflare-workers-deploy
```

- [ ] **Step 2: Merge the verified branch into master**

```bash
git switch master
git merge --no-ff codex/fix-cloudflare-workers-deploy
```

- [ ] **Step 3: Verify the merged master**

```bash
corepack pnpm verify
```

Expected: lint, typecheck, unit tests, and production build all exit with code 0.

- [ ] **Step 4: Push master**

```bash
git push origin master
```

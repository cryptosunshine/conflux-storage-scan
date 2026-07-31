import { access, readFile } from "node:fs/promises"

const requiredFiles = [
	"AGENTS.md",
	".agents/skills/develop-conflux-storage-data/SKILL.md",
	".agents/skills/integrate-rainbowkit-wallets/SKILL.md",
	".agents/skills/design-conflux-storage-ui/SKILL.md",
	"package.json",
]

const requiredRules = new Map([
	[
		"AGENTS.md",
		[
			"read-only",
			"branch-only Storage Node POC",
			"codex/direct-storage-node-poc",
			"0 CFX",
			"StorageDataSource",
			"develop-conflux-storage-data",
			"integrate-rainbowkit-wallets",
			"design-conflux-storage-ui",
			"Never call `pricePerSector`",
			"Never merge this POC into `master`",
			"pnpm verify",
			"pnpm verify:ui",
		],
	],
	[
		".agents/skills/develop-conflux-storage-data/SKILL.md",
		["submission.submitter", "256", "batchSubmit", "Beacon", "pricePerSector", "direct Storage Node", "value: 0n"],
	],
	[
		".agents/skills/integrate-rainbowkit-wallets/SKILL.md",
		["RainbowKit", "wagmi", "EIP-6963", "multiInjectedProviderDiscovery", "read-only", "user-confirmed"],
	],
	[
		".agents/skills/design-conflux-storage-ui/SKILL.md",
		[
			"Light Theme",
			"#17B38A",
			"/submissions",
			"/history",
			"/analytics",
			"/storage",
			"Local HTTP POC",
			"100 MiB",
			"no additional RPC",
			"download",
			"mining",
			"boundingBox",
			"CSS classes",
		],
	],
	["package.json", ['"verify:ui"', "pnpm harness:validate && pnpm verify && pnpm test:e2e"]],
])

for (const file of requiredFiles) {
	await access(file)
	const text = await readFile(file, "utf8")

	if (text.includes("TODO") || text.includes("TBD")) {
		throw new Error(`${file} contains a placeholder`)
	}

	for (const rule of requiredRules.get(file) ?? []) {
		if (!text.includes(rule)) {
			throw new Error(`${file} is missing required rule: ${rule}`)
		}
	}
}

const wranglerConfig = await readFile("wrangler.jsonc", "utf8")
for (const rule of [
	'"main": "src/storage-node-proxy/worker.ts"',
	'"run_worker_first": ["/api/storage-node/*"]',
	'"binding": "ASSETS"',
	'"STORAGE_NODE_UPSTREAM_URLS"',
	"0gdevnet.confluxrpc.org",
]) {
	if (!wranglerConfig.includes(rule)) {
		throw new Error(`wrangler.jsonc is missing required deployment rule: ${rule}`)
	}
}

console.log(`Validated ${requiredFiles.length} agent harness files`)

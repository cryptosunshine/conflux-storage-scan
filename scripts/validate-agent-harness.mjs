import { access, readFile } from "node:fs/promises"

const requiredFiles = [
	"AGENTS.md",
	".agents/skills/develop-conflux-storage-data/SKILL.md",
	".agents/skills/integrate-rainbowkit-wallets/SKILL.md",
	".agents/skills/design-conflux-storage-ui/SKILL.md",
]

const requiredRules = new Map([
	[
		"AGENTS.md",
		[
			"read-only",
			"0 CFX",
			"StorageDataSource",
			"develop-conflux-storage-data",
			"integrate-rainbowkit-wallets",
			"design-conflux-storage-ui",
			"pnpm verify",
		],
	],
	[
		".agents/skills/develop-conflux-storage-data/SKILL.md",
		["submission.submitter", "256", "batchSubmit", "Beacon", "pricePerSector"],
	],
	[
		".agents/skills/integrate-rainbowkit-wallets/SKILL.md",
		["RainbowKit", "wagmi", "EIP-6963", "multiInjectedProviderDiscovery", "read-only"],
	],
	[
		".agents/skills/design-conflux-storage-ui/SKILL.md",
		["Light Theme", "#17B38A", "/submissions", "/history", "download", "mining"],
	],
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

console.log(`Validated ${requiredFiles.length} agent harness files`)

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("Storage Node live probe safety", () => {
	it("contains only read-only node and chain operations", async () => {
		const source = await readFile(join(process.cwd(), "scripts/harness/storage-node-probe.ts"), "utf8")

		for (const forbidden of ["zgs_upload", "submit", "writeContract", "sendTransaction", "privateKey"]) {
			expect(source).not.toContain(forbidden)
		}
		expect(source).toContain("inspectStorageNodes")
		expect(source).toContain("getFileInfoByTxSeq")
		expect(source).toContain("getBlockNumber")
	})
})

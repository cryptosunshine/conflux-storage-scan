import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createFixtureManifest, validateFixtureDirectory } from "./manifest"

describe("fixture manifest", () => {
	let root: string

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "conflux-storage-manifest-"))
		await mkdir(join(root, "captures"), { recursive: true })
		await mkdir(join(root, "expected"), { recursive: true })
	})

	afterEach(async () => {
		await rm(root, { force: true, recursive: true })
	})

	it("detects a response changed after checksums were recorded", async () => {
		const files = {
			"captures/requests.json": "[]\n",
			"captures/responses.json": "[]\n",
			"expected/submissions.json": "[]\n",
			"expected/summary.json": '{"logs":"0"}\n',
		}
		for (const [path, contents] of Object.entries(files)) {
			await writeFile(join(root, path), contents)
		}

		const manifest = createFixtureManifest({
			abiSha256: "a".repeat(64),
			capturedAt: "2026-07-28T00:00:00.000Z",
			expectedSubmissions: 0,
			featureFlags: {
				blockTimestamp: false,
				transactionLogIndex: false,
			},
			fileContents: files,
			headBlockHash: `0x${"11".repeat(32)}`,
			headBlockNumber: 253_160_900n,
			logToBlock: 253_160_900n,
		})
		await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)

		await expect(validateFixtureDirectory(root)).resolves.toBeUndefined()
		await writeFile(join(root, "captures/responses.json"), '[{"changed":true}]\n')
		await expect(validateFixtureDirectory(root)).rejects.toMatchObject({
			code: "CHECKSUM_MISMATCH",
		})
	})
})

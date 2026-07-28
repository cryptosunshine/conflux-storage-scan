import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { nextFixtureVersion, publishFixture } from "./fixture-writer"

describe("fixture writer", () => {
	let root: string

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "conflux-storage-fixtures-"))
	})

	afterEach(async () => {
		await rm(root, { force: true, recursive: true })
	})

	it("selects the next version and never overwrites an accepted version", async () => {
		await mkdir(join(root, "v1"), { recursive: true })
		await writeFile(join(root, "v1", "marker.txt"), "accepted")

		expect(await nextFixtureVersion(root)).toBe("v2")
		await expect(
			publishFixture(root, "v1", {
				"manifest.json": { chainId: 71 },
			}),
		).rejects.toMatchObject({
			code: "FIXTURE_EXISTS",
		})
		expect(await readFile(join(root, "v1", "marker.txt"), "utf8")).toBe("accepted")
	})

	it("removes its temporary state when validation fails", async () => {
		await expect(
			publishFixture(
				root,
				"v1",
				{
					"manifest.json": { chainId: 71 },
				},
				async () => {
					throw new Error("invalid fixture")
				},
			),
		).rejects.toThrow("invalid fixture")

		expect(await readdir(root)).toEqual([])
	})
})

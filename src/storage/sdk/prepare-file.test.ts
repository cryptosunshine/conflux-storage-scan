import { decodeBase64 } from "ethers"
import { getAddress } from "viem"
import { describe, expect, it } from "vitest"
import { STORAGE_POC_MAX_FILE_BYTES } from "../config"
import { storageSdkFixtureRoots } from "./fixtures"
import { createStorageSegment, prepareStorageFile } from "./prepare-file"

const submitter = getAddress("0x0000000000000000000000000000000000000071")

function fixtureFile(size: number): File {
	const bytes = Uint8Array.from({ length: size }, (_, index) => index % 251)
	return new File([bytes], `fixture-${size}.bin`, { type: "application/octet-stream" })
}

describe("prepareStorageFile", () => {
	it("rejects empty and oversized files before hashing", async () => {
		await expect(prepareStorageFile(new File([], "empty.bin"), submitter)).rejects.toMatchObject({
			code: "EMPTY_FILE",
		})
		await expect(
			prepareStorageFile(
				{
					name: "oversized.bin",
					size: STORAGE_POC_MAX_FILE_BYTES + 1,
				} as File,
				submitter,
			),
		).rejects.toMatchObject({
			code: "FILE_TOO_LARGE",
		})
	})

	for (const [size, expectedRoot] of Object.entries(storageSdkFixtureRoots)) {
		it(`matches the locked upstream Root for ${size} bytes`, async () => {
			const prepared = await prepareStorageFile(fixtureFile(Number(size)), submitter)

			expect(prepared.root).toBe(expectedRoot)
			expect(prepared.submission.data.length).toBe(BigInt(size))
			expect(prepared.submission.data.tags).toBe("0x")
			expect(prepared.submission.submitter).toBe(submitter)
		})
	}

	it("builds two proved Segments across the 256 KiB boundary", async () => {
		const prepared = await prepareStorageFile(fixtureFile(262_145), submitter)
		const first = await createStorageSegment(prepared, 0)
		const second = await createStorageSegment(prepared, 1)
		const secondBytes = decodeBase64(second.data)

		expect(prepared.chunkCount).toBe(1025)
		expect(prepared.segmentCount).toBe(2)
		expect(first.index).toBe(0)
		expect(second.index).toBe(1)
		expect(secondBytes).toHaveLength(256)
		expect(secondBytes[0]).toBe(100)
		expect(secondBytes.slice(1).every((byte) => byte === 0)).toBe(true)
		expect(
			prepared.tree.proofAt(1).validateHash(
				prepared.root,
				second.proof.lemma[0] ?? "0x",
				1,
				prepared.segmentCount,
			),
		).toBeNull()
	})

	it("rejects a Segment index outside the prepared tree", async () => {
		const prepared = await prepareStorageFile(fixtureFile(1), submitter)

		await expect(createStorageSegment(prepared, 1)).rejects.toMatchObject({
			code: "INVALID_ARGUMENT",
		})
	})
})

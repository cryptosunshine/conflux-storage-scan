import { encodeBase64 } from "ethers"
import { type Hex, zeroAddress } from "viem"
import { describe, expect, it, vi } from "vitest"
import { STORAGE_POC_MAX_FILE_BYTES } from "../config"
import { encodeStorageFileMetadata } from "../metadata/file-metadata"
import type { StorageNodeClient } from "../node/storage-node-client"
import { prepareStorageFile } from "../sdk/prepare-file"
import type { StorageNodeFileInfo } from "../types"
import { downloadAndVerifyStorageFile } from "./download-file"

function fixtureBytes(size: number): Uint8Array {
	return Uint8Array.from({ length: size }, (_, index) => index % 251)
}

function blobPart(bytes: Uint8Array): ArrayBuffer {
	return Uint8Array.from(bytes).buffer
}

function fileInfo(root: Hex, size: number, txSeq = 485): StorageNodeFileInfo {
	return {
		finalized: true,
		isCached: false,
		pruned: false,
		tx: {
			dataMerkleRoot: root,
			seq: txSeq,
			size,
			startEntryIndex: 0n,
		},
		uploadedSegNum: Math.ceil(size / 262_144),
	}
}

function client(input: {
	readonly info: StorageNodeFileInfo | null
	readonly segments?: ReadonlyMap<string, string>
}): StorageNodeClient {
	return {
		url: "http://node",
		downloadSegmentByTxSeq: vi.fn(async (txSeq, startChunk, endChunk) => {
			return input.segments?.get(`${txSeq}:${startChunk}:${endChunk}`) ?? ""
		}),
		getFileInfo: vi.fn(async () => input.info),
		getFileInfoByTxSeq: vi.fn(async () => input.info),
		getShardConfig: async () => ({ numShard: 1, shardId: 0 }),
		getStatus: async () => {
			throw new Error("not used")
		},
		uploadSegmentsByTxSeq: async () => 0,
	}
}

describe("downloadAndVerifyStorageFile", () => {
	it("downloads by TxSeq, trims Chunk padding, and verifies the Root", async () => {
		const bytes = fixtureBytes(1)
		const prepared = await prepareStorageFile(new File([blobPart(bytes)], "source.bin"), zeroAddress)
		const padded = new Uint8Array(256)
		padded.set(bytes)
		const node = client({
			info: fileInfo(prepared.root, bytes.length),
			segments: new Map([["485:0:1", encodeBase64(padded)]]),
		})

		const result = await downloadAndVerifyStorageFile({
			client: node,
			originalFile: new File([blobPart(bytes)], "source.bin"),
			target: { txSeq: 485 },
		})

		expect(result).toMatchObject({
			bytesEqual: true,
			root: prepared.root,
			txSeq: 485,
			verified: true,
		})
		expect(result.file.name).toBe("source.bin")
		expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(bytes)
		expect(node.downloadSegmentByTxSeq).toHaveBeenCalledWith(485, 0, 1)
	})

	it("preserves the verified original file name and media type", async () => {
		const bytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
		const originalFile = new File([blobPart(bytes)], "t.png", {
			type: "image/png",
		})
		const prepared = await prepareStorageFile(originalFile, zeroAddress)
		const padded = new Uint8Array(256)
		padded.set(bytes)
		const node = client({
			info: fileInfo(prepared.root, bytes.length, 486),
			segments: new Map([["486:0:1", encodeBase64(padded)]]),
		})

		const result = await downloadAndVerifyStorageFile({
			client: node,
			originalFile,
			target: { txSeq: 486 },
		})

		expect(result.file.name).toBe("t.png")
		expect(result.file.type).toBe("image/png")
		expect(result.bytesEqual).toBe(true)
	})

	it("restores the public file name and media type without the original File", async () => {
		const bytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
		const source = new File([blobPart(bytes)], "t.png", {
			type: "image/png",
		})
		const prepared = await prepareStorageFile(source, zeroAddress)
		const padded = new Uint8Array(256)
		padded.set(bytes)
		const node = client({
			info: fileInfo(prepared.root, bytes.length, 486),
			segments: new Map([["486:0:1", encodeBase64(padded)]]),
		})

		const result = await downloadAndVerifyStorageFile({
			client: node,
			resolveSubmission: async (txSeq) => {
				expect(txSeq).toBe(486)
				return {
					logicalSizeBytes: BigInt(bytes.length),
					tags: encodeStorageFileMetadata(source),
				}
			},
			target: { root: prepared.root },
		})

		expect(result.file.name).toBe("t.png")
		expect(result.file.type).toBe("image/png")
		expect(result.fileMetadataRecovered).toBe(true)
	})

	it("uses a generic filename for an old tags=0x submission", async () => {
		const bytes = fixtureBytes(1)
		const prepared = await prepareStorageFile(new File([blobPart(bytes)], "source.bin"), zeroAddress)
		const padded = new Uint8Array(256)
		padded.set(bytes)

		const result = await downloadAndVerifyStorageFile({
			client: client({
				info: fileInfo(prepared.root, bytes.length, 486),
				segments: new Map([["486:0:1", encodeBase64(padded)]]),
			}),
			resolveSubmission: async () => ({
				logicalSizeBytes: 1n,
				tags: "0x",
			}),
			target: { txSeq: 486 },
		})

		expect(result.file.name).toBe("storage-486.bin")
		expect(result.file.type).toBe("application/octet-stream")
		expect(result.fileMetadataRecovered).toBe(false)
	})

	it("downloads multiple Segments by Root with exact Chunk ranges", async () => {
		const bytes = fixtureBytes(262_145)
		const prepared = await prepareStorageFile(new File([blobPart(bytes)], "source.bin"), zeroAddress)
		const lastChunk = new Uint8Array(256)
		lastChunk[0] = bytes.at(-1) ?? 0
		const node = client({
			info: fileInfo(prepared.root, bytes.length),
			segments: new Map([
				["485:0:1024", encodeBase64(bytes.slice(0, 262_144))],
				["485:1024:1025", encodeBase64(lastChunk)],
			]),
		})

		const result = await downloadAndVerifyStorageFile({
			client: node,
			target: { root: prepared.root },
		})

		expect(result.file.size).toBe(262_145)
		expect(result.verified).toBe(true)
		expect(node.getFileInfo).toHaveBeenCalledWith(prepared.root, true)
		expect(node.downloadSegmentByTxSeq).toHaveBeenNthCalledWith(1, 485, 0, 1024)
		expect(node.downloadSegmentByTxSeq).toHaveBeenNthCalledWith(2, 485, 1024, 1025)
	})

	it("rejects missing and oversized FileInfo before downloading", async () => {
		await expect(
			downloadAndVerifyStorageFile({
				client: client({ info: null }),
				target: { txSeq: 485 },
			}),
		).rejects.toMatchObject({ code: "DOWNLOAD_NOT_FOUND" })

		const download = vi.fn(async () => "")
		await expect(
			downloadAndVerifyStorageFile({
				client: {
					...client({
						info: fileInfo(`0x${"11".repeat(32)}`, STORAGE_POC_MAX_FILE_BYTES + 1),
					}),
					downloadSegmentByTxSeq: download,
				},
				target: { txSeq: 485 },
			}),
		).rejects.toMatchObject({ code: "FILE_TOO_LARGE" })
		expect(download).not.toHaveBeenCalled()
	})

	it("rejects missing Segment data and Root mismatches", async () => {
		const expectedRoot = `0x${"11".repeat(32)}` as Hex

		await expect(
			downloadAndVerifyStorageFile({
				client: client({
					info: fileInfo(expectedRoot, 1),
					segments: new Map([["485:0:1", ""]]),
				}),
				target: { txSeq: 485 },
			}),
		).rejects.toMatchObject({ code: "DOWNLOAD_FAILED" })

		await expect(
			downloadAndVerifyStorageFile({
				client: client({
					info: fileInfo(expectedRoot, 1),
					segments: new Map([["485:0:1", encodeBase64(new Uint8Array(256))]]),
				}),
				target: { txSeq: 485 },
			}),
		).rejects.toMatchObject({ code: "INTEGRITY_MISMATCH" })
	})

	it("rejects a canonical Submit size that conflicts with FileInfo", async () => {
		const bytes = fixtureBytes(1)
		const prepared = await prepareStorageFile(new File([blobPart(bytes)], "source.bin"), zeroAddress)
		const download = vi.fn(async () => encodeBase64(new Uint8Array(256)))

		await expect(
			downloadAndVerifyStorageFile({
				client: {
					...client({
						info: fileInfo(prepared.root, bytes.length, 486),
					}),
					downloadSegmentByTxSeq: download,
				},
				resolveSubmission: async () => ({
					logicalSizeBytes: 2n,
					tags: "0x",
				}),
				target: { txSeq: 486 },
			}),
		).rejects.toMatchObject({ code: "FILE_INFO_MISMATCH" })
		expect(download).not.toHaveBeenCalled()
	})
})

import { encodeBase64 } from "ethers"
import { type Hex, zeroAddress } from "viem"
import { describe, expect, it, vi } from "vitest"
import { STORAGE_POC_MAX_FILE_BYTES } from "../config"
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
		expect(result.file.name).toBe("storage-485.bin")
		expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(bytes)
		expect(node.downloadSegmentByTxSeq).toHaveBeenCalledWith(485, 0, 1)
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
})

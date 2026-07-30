import type { Hex } from "viem"
import { describe, expect, it } from "vitest"
import type { PreparedStorageFile } from "../sdk/prepare-file"
import {
	StorageNodeRpcError,
	type StorageNodeClient,
} from "../node/storage-node-client"
import type { StorageSegmentWithProof } from "../types"
import { uploadPreparedSegments } from "./upload-segments"

const root = `0x${"11".repeat(32)}` as Hex

function prepared(segmentCount: number): PreparedStorageFile {
	return {
		chunkCount: segmentCount * 1024,
		identity: `0x${"22".repeat(32)}`,
		root,
		sdkFile: {} as PreparedStorageFile["sdkFile"],
		segmentCount,
		source: new File([new Uint8Array(segmentCount * 262_144)], "fixture.bin"),
		submission: {
			data: { length: BigInt(segmentCount * 262_144), nodes: [], tags: "0x" },
			submitter: "0x0000000000000000000000000000000000000071",
		},
		tree: {} as PreparedStorageFile["tree"],
	}
}

function segment(index: number, fileSize: number): StorageSegmentWithProof {
	return {
		data: "AA==",
		fileSize,
		index,
		proof: { lemma: [root], path: [] },
		root,
	}
}

function fakeClient(
	upload: StorageNodeClient["uploadSegmentsByTxSeq"],
): StorageNodeClient {
	return {
		url: "http://node",
		downloadSegmentByTxSeq: async () => "",
		getFileInfo: async () => null,
		getFileInfoByTxSeq: async () => null,
		getShardConfig: async () => ({ numShard: 1, shardId: 0 }),
		getStatus: async () => {
			throw new Error("not used")
		},
		uploadSegmentsByTxSeq: upload,
	}
}

describe("uploadPreparedSegments", () => {
	it("uploads with at most two workers and reports confirmed progress", async () => {
		let active = 0
		let maximumActive = 0
		const uploaded: number[] = []
		const progress: number[] = []
		const file = prepared(5)
		const client = fakeClient(async (segments, txSeq) => {
			active += 1
			maximumActive = Math.max(maximumActive, active)
			expect(txSeq).toBe(485)
			await Promise.resolve()
			uploaded.push(segments[0]?.index ?? -1)
			active -= 1
			return 0
		})

		await uploadPreparedSegments({
			client,
			createSegment: async (_prepared, index) => segment(index, file.source.size),
			onProgress: ({ confirmedSegments }) => progress.push(confirmedSegments),
			prepared: file,
			txSeq: 485,
		})

		expect(maximumActive).toBeLessThanOrEqual(2)
		expect(uploaded.sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4])
		expect(progress.at(-1)).toBe(5)
	})

	it("retries temporary write pressure with increasing delays", async () => {
		let attempts = 0
		const delays: number[] = []
		const file = prepared(1)
		const client = fakeClient(async () => {
			attempts += 1
			if (attempts < 3) {
				throw new StorageNodeRpcError("RPC_ERROR", "too many data writing")
			}
			return 0
		})

		await uploadPreparedSegments({
			client,
			createSegment: async () => segment(0, file.source.size),
			prepared: file,
			sleep: async (milliseconds) => {
				delays.push(milliseconds)
			},
			txSeq: 485,
		})

		expect(attempts).toBe(3)
		expect(delays).toEqual([500, 1000])
	})

	it("treats an already-uploaded response as idempotent success", async () => {
		const file = prepared(1)
		const client = fakeClient(async () => {
			throw new StorageNodeRpcError("RPC_ERROR", "segment already uploaded and finalized")
		})

		await expect(
			uploadPreparedSegments({
				client,
				createSegment: async () => segment(0, file.source.size),
				prepared: file,
				txSeq: 485,
			}),
		).resolves.toBeUndefined()
	})

	it("stops immediately for a non-retryable upload error", async () => {
		let attempts = 0
		const file = prepared(1)
		const client = fakeClient(async () => {
			attempts += 1
			throw new StorageNodeRpcError("RPC_ERROR", "invalid Merkle proof")
		})

		await expect(
			uploadPreparedSegments({
				client,
				createSegment: async () => segment(0, file.source.size),
				prepared: file,
				txSeq: 485,
			}),
		).rejects.toMatchObject({
			code: "UPLOAD_FAILED",
		})
		expect(attempts).toBe(1)
	})
})

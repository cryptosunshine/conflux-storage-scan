import type { Hex } from "viem"
import { describe, expect, it } from "vitest"
import type { StorageNodeFileInfo } from "../types"
import type { StorageNodeClient } from "../node/storage-node-client"
import { waitForNodeFileInfo } from "./wait-for-node"

const root = `0x${"11".repeat(32)}` as Hex

function fileInfo(overrides: Partial<StorageNodeFileInfo> = {}): StorageNodeFileInfo {
	return {
		finalized: false,
		isCached: false,
		pruned: false,
		tx: {
			dataMerkleRoot: root,
			seq: 485,
			size: 257,
			startEntryIndex: 290_624n,
		},
		uploadedSegNum: 0,
		...overrides,
	}
}

function clientWithFileInfos(infos: readonly (StorageNodeFileInfo | null)[]): StorageNodeClient {
	let index = 0
	return {
		url: "http://node",
		downloadSegmentByTxSeq: async () => "",
		getFileInfo: async () => null,
		getFileInfoByTxSeq: async () => infos[Math.min(index++, infos.length - 1)] ?? null,
		getShardConfig: async () => ({ numShard: 1, shardId: 0 }),
		getStatus: async () => {
			throw new Error("not used")
		},
		uploadSegmentsByTxSeq: async () => 0,
	}
}

describe("waitForNodeFileInfo", () => {
	it("returns after the node synchronizes the expected transaction", async () => {
		let now = 0
		const info = await waitForNodeFileInfo({
			client: clientWithFileInfos([null, null, fileInfo()]),
			expectedRoot: root,
			expectedSize: 257,
			now: () => now,
			pollIntervalMs: 10,
			sleep: async (milliseconds) => {
				now += milliseconds
			},
			timeoutMs: 100,
			txSeq: 485,
		})

		expect(info.tx.seq).toBe(485)
		expect(now).toBe(20)
	})

	it("times out without inventing a transaction retry", async () => {
		let now = 0

		await expect(
			waitForNodeFileInfo({
				client: clientWithFileInfos([null]),
				expectedRoot: root,
				expectedSize: 257,
				now: () => now,
				pollIntervalMs: 10,
				sleep: async (milliseconds) => {
					now += milliseconds
				},
				timeoutMs: 25,
				txSeq: 485,
			}),
		).rejects.toMatchObject({
			code: "NODE_SYNC_TIMEOUT",
		})
	})

	it("rejects Root, size, and sequence mismatches", async () => {
		for (const info of [
			fileInfo({
				tx: { dataMerkleRoot: `0x${"22".repeat(32)}`, seq: 485, size: 257, startEntryIndex: 0n },
			}),
			fileInfo({
				tx: { dataMerkleRoot: root, seq: 485, size: 258, startEntryIndex: 0n },
			}),
			fileInfo({
				tx: { dataMerkleRoot: root, seq: 484, size: 257, startEntryIndex: 0n },
			}),
		]) {
			await expect(
				waitForNodeFileInfo({
					client: clientWithFileInfos([info]),
					expectedRoot: root,
					expectedSize: 257,
					txSeq: 485,
				}),
			).rejects.toMatchObject({
				code: "FILE_INFO_MISMATCH",
			})
		}
	})
})

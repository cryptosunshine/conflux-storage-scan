import type { Hex } from "viem"
import { describe, expect, it } from "vitest"
import type { HealthyStorageNode } from "../node/node-pool"
import type { StorageNodeClient } from "../node/storage-node-client"
import type { StorageNodeFileInfo } from "../types"
import { confirmUploadOnHealthyNodes } from "./confirm-upload-on-nodes"

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
		uploadedSegNum: 1,
		...overrides,
	}
}

function healthyNode(clientUrl: string, client: StorageNodeClient): HealthyStorageNode {
	return {
		blockLag: 1n,
		client: { ...client, url: clientUrl },
		healthy: true,
		latencyMs: 10,
		shard: { numShard: 1, shardId: 0 },
		status: {
			connectedPeers: 1,
			logSyncBlock: `0x${"22".repeat(32)}`,
			logSyncHeight: 100n,
			networkIdentity: {
				chainId: 71,
				flowAddress: "0x3fF03285AA79027Ecc552432336FCB85eaD7199e",
				p2pProtocolVersion: { build: 0, major: 0, minor: 4 },
			},
			nextTxSeq: 491,
		},
	}
}

function clientWithFileInfos(url: string, infos: readonly (StorageNodeFileInfo | null)[]): StorageNodeClient {
	let index = 0
	return {
		url,
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

describe("confirmUploadOnHealthyNodes", () => {
	it("returns the first healthy node that reports a fully uploaded file", async () => {
		const laggingClient = clientWithFileInfos("http://lagging", [null])
		const healthyClient = clientWithFileInfos("http://healthy", [fileInfo()])
		let now = 0

		const selected = await confirmUploadOnHealthyNodes({
			expectedRoot: root,
			expectedSegments: 1,
			expectedSize: 257,
			nodes: [healthyNode("http://lagging", laggingClient), healthyNode("http://healthy", healthyClient)],
			now: () => now,
			pollIntervalMs: 10,
			sleep: async (milliseconds) => {
				now += milliseconds
			},
			timeoutMs: 100,
			txSeq: 485,
		})

		expect(selected.client.url).toBe("http://healthy")
	})

	it("polls until the upload becomes visible on a node", async () => {
		const client = clientWithFileInfos("http://healthy", [
			null,
			fileInfo({ uploadedSegNum: 0 }),
			fileInfo({ uploadedSegNum: 1 }),
		])
		let now = 0

		const selected = await confirmUploadOnHealthyNodes({
			expectedRoot: root,
			expectedSegments: 1,
			expectedSize: 257,
			nodes: [healthyNode("http://healthy", client)],
			now: () => now,
			pollIntervalMs: 10,
			sleep: async (milliseconds) => {
				now += milliseconds
			},
			timeoutMs: 100,
			txSeq: 485,
		})

		expect(selected.client.url).toBe("http://healthy")
		expect(now).toBe(20)
	})

	it("times out when no node confirms the upload", async () => {
		let now = 0

		await expect(
			confirmUploadOnHealthyNodes({
				expectedRoot: root,
				expectedSegments: 1,
				expectedSize: 257,
				nodes: [healthyNode("http://healthy", clientWithFileInfos("http://healthy", [null]))],
				now: () => now,
				pollIntervalMs: 10,
				sleep: async (milliseconds) => {
					now += milliseconds
				},
				timeoutMs: 25,
				txSeq: 485,
			}),
		).rejects.toMatchObject({
			code: "UPLOAD_NOT_CONFIRMED",
		})
	})

	it("ignores mismatched file metadata while polling", async () => {
		const client = clientWithFileInfos("http://healthy", [
			fileInfo({
				tx: { dataMerkleRoot: `0x${"33".repeat(32)}`, seq: 485, size: 257, startEntryIndex: 0n },
			}),
			fileInfo(),
		])
		let now = 0

		const selected = await confirmUploadOnHealthyNodes({
			expectedRoot: root,
			expectedSegments: 1,
			expectedSize: 257,
			nodes: [healthyNode("http://healthy", client)],
			now: () => now,
			pollIntervalMs: 10,
			sleep: async (milliseconds) => {
				now += milliseconds
			},
			timeoutMs: 100,
			txSeq: 485,
		})

		expect(selected.client.url).toBe("http://healthy")
		expect(now).toBe(10)
	})
})

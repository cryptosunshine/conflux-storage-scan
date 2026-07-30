import type { Address, Hex } from "viem"
import { describe, expect, it } from "vitest"
import type { StorageNodeFileInfo, StorageNodeStatus, StorageSegmentWithProof, StorageShardConfig } from "../types"
import { inspectStorageNodes, selectStorageNode } from "./node-pool"
import type { StorageNodeClient } from "./storage-node-client"

const proxy = "0x3fF03285AA79027Ecc552432336FCB85eaD7199e" as Address

interface FakeNodeOptions {
	readonly chainId?: number
	readonly flowAddress?: Address
	readonly logSyncHeight: bigint
	readonly nextTxSeq: number
	readonly numShard?: number
	readonly shardId?: number
	readonly statusError?: Error
	readonly url: string
}

function fakeNode(options: FakeNodeOptions): StorageNodeClient {
	const status: StorageNodeStatus = {
		connectedPeers: 1,
		logSyncBlock: `0x${"11".repeat(32)}` as Hex,
		logSyncHeight: options.logSyncHeight,
		networkIdentity: {
			chainId: options.chainId ?? 71,
			flowAddress: options.flowAddress ?? proxy,
			p2pProtocolVersion: { build: 0, major: 0, minor: 4 },
		},
		nextTxSeq: options.nextTxSeq,
	}
	const shard: StorageShardConfig = {
		numShard: options.numShard ?? 1,
		shardId: options.shardId ?? 0,
	}

	return {
		url: options.url,
		downloadSegmentByTxSeq: async () => "",
		getFileInfo: async (): Promise<StorageNodeFileInfo | null> => null,
		getFileInfoByTxSeq: async (): Promise<StorageNodeFileInfo | null> => null,
		getShardConfig: async () => shard,
		getStatus: async () => {
			if (options.statusError) {
				throw options.statusError
			}
			return status
		},
		uploadSegmentsByTxSeq: async (_segments: readonly StorageSegmentWithProof[]) => 0,
	}
}

describe("Storage Node pool", () => {
	it("selects the highest synchronized complete node", async () => {
		const selected = await selectStorageNode({
			chainHead: 258_467_910n,
			clients: [
				fakeNode({
					logSyncHeight: 258_316_358n,
					nextTxSeq: 484,
					url: "http://47.84.225.228:5678",
				}),
				fakeNode({
					logSyncHeight: 258_467_864n,
					nextTxSeq: 486,
					url: "http://47.84.224.253:5678",
				}),
			],
			requiredTxSeq: 485,
		})

		expect(selected.client.url).toBe("http://47.84.224.253:5678")
		expect(selected.blockLag).toBe(46n)
		expect(selected.healthy).toBe(true)
	})

	it("reports identity, lag, shard, synchronization, and network failures separately", async () => {
		const health = await inspectStorageNodes({
			chainHead: 10_000n,
			clients: [
				fakeNode({
					chainId: 1,
					logSyncHeight: 10_000n,
					nextTxSeq: 486,
					url: "http://wrong-chain",
				}),
				fakeNode({
					flowAddress: "0x0000000000000000000000000000000000000071",
					logSyncHeight: 10_000n,
					nextTxSeq: 486,
					url: "http://wrong-flow",
				}),
				fakeNode({
					logSyncHeight: 9_000n,
					nextTxSeq: 486,
					url: "http://lagging",
				}),
				fakeNode({
					logSyncHeight: 10_000n,
					nextTxSeq: 486,
					numShard: 2,
					url: "http://partial-shard",
				}),
				fakeNode({
					logSyncHeight: 10_000n,
					nextTxSeq: 485,
					url: "http://missing-sequence",
				}),
				fakeNode({
					logSyncHeight: 10_000n,
					nextTxSeq: 486,
					statusError: new Error("offline"),
					url: "http://offline",
				}),
			],
			requiredTxSeq: 485,
		})

		expect(health.map(({ reason }) => reason)).toEqual([
			"wrong-chain",
			"wrong-flow",
			"lagging",
			"incomplete-shard",
			"sequence-unavailable",
			"unreachable",
		])
		expect(health.every(({ healthy }) => !healthy)).toBe(true)
	})

	it("throws a typed error when no healthy node is available", async () => {
		await expect(
			selectStorageNode({
				chainHead: 10_000n,
				clients: [
					fakeNode({
						logSyncHeight: 9_000n,
						nextTxSeq: 0,
						url: "http://lagging",
					}),
				],
			}),
		).rejects.toMatchObject({
			code: "NO_HEALTHY_NODE",
		})
	})
})

import { encodeBase64 } from "ethers"
import { type Address, type Hex, zeroAddress, zeroHash } from "viem"
import { FIXED_PRICE_FLOW_PROXY } from "../chain/config"
import type { DownloadAndVerifyStorageFileInput, StorageDownloadResult } from "./download/download-file"
import type { HealthyStorageNode, StorageNodeHealth } from "./node/node-pool"
import type { StorageNodeClient } from "./node/storage-node-client"
import type { StoragePocRuntime } from "./runtime"
import { type PreparedStorageFile, prepareStorageFile } from "./sdk/prepare-file"
import type { StorageSessionStore } from "./session/storage-session-store"
import type { StorageUploadSession } from "./session/upload-session"
import type { StorageNodeFileInfo, StorageNodeStatus, StorageSegmentWithProof, StorageShardConfig } from "./types"
import type { UploadPreparedSegmentsInput } from "./upload/upload-segments"
import type { WaitForNodeFileInfoInput } from "./upload/wait-for-node"

const FIXTURE_NODE_URL = "fixture://conflux-storage-node"

function createMemoryStorageSessionStore(): StorageSessionStore {
	const sessions = new Map<string, StorageUploadSession>()
	return {
		async clear() {
			sessions.clear()
		},
		async delete(id) {
			sessions.delete(id)
		},
		async get(id) {
			return sessions.get(id)
		},
		async getLatest() {
			return [...sessions.values()].sort((left, right) => right.updatedAt - left.updatedAt)[0]
		},
		async put(session) {
			sessions.set(session.id, structuredClone(session))
		},
	}
}

const fixtureStatus: StorageNodeStatus = {
	connectedPeers: 8,
	logSyncBlock: zeroHash,
	logSyncHeight: 253_160_999n,
	networkIdentity: {
		chainId: 71,
		flowAddress: FIXED_PRICE_FLOW_PROXY,
		p2pProtocolVersion: {
			build: 0,
			major: 0,
			minor: 1,
		},
	},
	nextTxSeq: 486,
}

const fixtureShard: StorageShardConfig = {
	numShard: 1,
	shardId: 0,
}

class FixtureStorageNodeClient implements StorageNodeClient {
	readonly url = FIXTURE_NODE_URL
	readonly #files = new Map<
		number,
		{
			readonly file: File
			readonly info: StorageNodeFileInfo
		}
	>()

	add(txSeq: number, prepared: PreparedStorageFile): StorageNodeFileInfo {
		const info: StorageNodeFileInfo = {
			finalized: true,
			isCached: true,
			pruned: false,
			tx: {
				dataMerkleRoot: prepared.root,
				seq: txSeq,
				size: prepared.source.size,
				startEntryIndex: 0n,
			},
			uploadedSegNum: prepared.segmentCount,
		}
		this.#files.set(txSeq, {
			file: prepared.source,
			info,
		})
		return info
	}

	async getStatus() {
		return fixtureStatus
	}

	async getShardConfig() {
		return fixtureShard
	}

	async getFileInfo(root: Hex, _needAvailable: boolean) {
		return (
			[...this.#files.values()].find((entry) => entry.info.tx.dataMerkleRoot.toLowerCase() === root.toLowerCase())
				?.info ?? null
		)
	}

	async getFileInfoByTxSeq(txSeq: number) {
		return this.#files.get(txSeq)?.info ?? null
	}

	async uploadSegmentsByTxSeq(_segments: readonly StorageSegmentWithProof[], _txSeq: number) {
		return 0
	}

	async downloadSegmentByTxSeq(txSeq: number, startChunk: number, endChunk: number) {
		const entry = this.#files.get(txSeq)
		if (!entry) {
			return ""
		}
		const bytes = new Uint8Array(await entry.file.slice(startChunk * 256, endChunk * 256).arrayBuffer())
		return encodeBase64(bytes)
	}
}

export interface CreateStoragePocFixtureRuntimeOptions {
	readonly sessionStore?: StorageSessionStore
}

export function createStoragePocFixtureRuntime({
	sessionStore = createMemoryStorageSessionStore(),
}: CreateStoragePocFixtureRuntimeOptions = {}): StoragePocRuntime {
	const client = new FixtureStorageNodeClient()
	let lastPrepared: PreparedStorageFile | undefined

	const health = (chainHead: bigint): HealthyStorageNode => ({
		blockLag: chainHead > fixtureStatus.logSyncHeight ? chainHead - fixtureStatus.logSyncHeight : 0n,
		client,
		healthy: true,
		latencyMs: 1,
		shard: fixtureShard,
		status: fixtureStatus,
	})

	return {
		async download(input: DownloadAndVerifyStorageFileInput): Promise<StorageDownloadResult> {
			let info =
				"txSeq" in input.target
					? await client.getFileInfoByTxSeq(input.target.txSeq)
					: await client.getFileInfo(input.target.root, true)
			if (!info && "txSeq" in input.target && input.target.txSeq === 485) {
				const fixtureFile = new File([Uint8Array.of(0)], "fixture-485.bin", {
					type: "application/octet-stream",
				})
				lastPrepared = await prepareStorageFile(fixtureFile, zeroAddress)
				info = client.add(485, lastPrepared)
			}
			if (!info) {
				throw new Error("Fixture file is unavailable")
			}
			const original = input.originalFile ?? lastPrepared?.source
			if (!original) {
				throw new Error("Fixture file bytes are unavailable")
			}
			return {
				bytesEqual: true,
				file: new File([await original.arrayBuffer()], `storage-${info.tx.seq}.bin`),
				fileMetadataRecovered: input.originalFile !== undefined,
				root: info.tx.dataMerkleRoot,
				txSeq: info.tx.seq,
				verified: true,
			}
		},
		async inspectNodes(chainHead): Promise<readonly StorageNodeHealth[]> {
			return [health(chainHead)]
		},
		mode: "fixture",
		async prepareFile(file: File, submitter: Address) {
			lastPrepared = await prepareStorageFile(file, submitter)
			return lastPrepared
		},
		async selectNode(chainHead) {
			return health(chainHead)
		},
		sessions: sessionStore,
		async upload(input: UploadPreparedSegmentsInput) {
			lastPrepared = input.prepared
			client.add(input.txSeq, input.prepared)
			input.onProgress?.({
				confirmedBytes: input.prepared.source.size,
				confirmedSegments: input.prepared.segmentCount,
				totalBytes: input.prepared.source.size,
				totalSegments: input.prepared.segmentCount,
			})
		},
		async waitForFile(input: WaitForNodeFileInfoInput) {
			const existing = await client.getFileInfoByTxSeq(input.txSeq)
			if (existing) {
				return existing
			}
			if (!lastPrepared) {
				throw new Error("Fixture file was not prepared")
			}
			return client.add(input.txSeq, lastPrepared)
		},
	}
}

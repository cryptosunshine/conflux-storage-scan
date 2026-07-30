import { getAddress, type Hex, isAddress, isHex, size } from "viem"
import { STORAGE_NODE_TIMEOUT_MS } from "../config"
import {
	type StorageNodeFileInfo,
	type StorageNodeStatus,
	StoragePocError,
	type StorageSegmentWithProof,
	type StorageShardConfig,
} from "../types"

type Fetch = typeof globalThis.fetch

interface JsonRpcSuccess {
	readonly id: number
	readonly jsonrpc: "2.0"
	readonly result: unknown
}

interface JsonRpcFailure {
	readonly error: {
		readonly code: number
		readonly message: string
	}
	readonly id: number
	readonly jsonrpc: "2.0"
}

export interface StorageNodeClient {
	readonly url: string
	downloadSegmentByTxSeq(txSeq: number, startChunk: number, endChunk: number): Promise<string>
	getFileInfo(root: Hex, needAvailable: boolean): Promise<StorageNodeFileInfo | null>
	getFileInfoByTxSeq(txSeq: number): Promise<StorageNodeFileInfo | null>
	getShardConfig(): Promise<StorageShardConfig>
	getStatus(): Promise<StorageNodeStatus>
	uploadSegmentsByTxSeq(segments: readonly StorageSegmentWithProof[], txSeq: number): Promise<number>
}

export interface HttpStorageNodeClientOptions {
	readonly fetch?: Fetch
	readonly timeoutMs?: number
}

export class StorageNodeRpcError extends StoragePocError {
	constructor(code: ConstructorParameters<typeof StoragePocError>[0], message: string, options?: ErrorOptions) {
		super(code, message, options)
		this.name = "StorageNodeRpcError"
	}
}

function malformed(label: string): StorageNodeRpcError {
	return new StorageNodeRpcError("MALFORMED_RESPONSE", `Storage Node returned malformed ${label}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireSafeInteger(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
		throw malformed(label)
	}
	return value
}

function requireBigInt(value: unknown, label: string): bigint {
	if (
		(typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) &&
		(typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value))
	) {
		throw malformed(label)
	}
	return BigInt(value)
}

function requireBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean") {
		throw malformed(label)
	}
	return value
}

function requireHash(value: unknown, label: string): Hex {
	if (typeof value !== "string" || !isHex(value, { strict: true }) || size(value) !== 32) {
		throw malformed(label)
	}
	return value
}

function requireAddress(value: unknown, label: string) {
	if (typeof value !== "string" || !isAddress(value)) {
		throw malformed(label)
	}
	return getAddress(value)
}

function requireArgumentInteger(value: number, label: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new StorageNodeRpcError("INVALID_ARGUMENT", `${label} must be a non-negative safe integer`)
	}
}

function parseStatus(value: unknown): StorageNodeStatus {
	if (!isRecord(value) || !isRecord(value.networkIdentity)) {
		throw malformed("status")
	}
	const protocol = value.networkIdentity.p2pProtocolVersion
	if (!isRecord(protocol)) {
		throw malformed("status protocol version")
	}

	return {
		connectedPeers: requireSafeInteger(value.connectedPeers, "connectedPeers"),
		logSyncBlock: requireHash(value.logSyncBlock, "logSyncBlock"),
		logSyncHeight: requireBigInt(value.logSyncHeight, "logSyncHeight"),
		networkIdentity: {
			chainId: requireSafeInteger(value.networkIdentity.chainId, "network chainId"),
			flowAddress: requireAddress(value.networkIdentity.flowAddress, "network flowAddress"),
			p2pProtocolVersion: {
				build: requireSafeInteger(protocol.build, "protocol build"),
				major: requireSafeInteger(protocol.major, "protocol major"),
				minor: requireSafeInteger(protocol.minor, "protocol minor"),
			},
		},
		nextTxSeq: requireSafeInteger(value.nextTxSeq, "nextTxSeq"),
	}
}

function parseShardConfig(value: unknown): StorageShardConfig {
	if (!isRecord(value)) {
		throw malformed("shard config")
	}
	return {
		numShard: requireSafeInteger(value.numShard, "numShard"),
		shardId: requireSafeInteger(value.shardId, "shardId"),
	}
}

function parseFileInfo(value: unknown): StorageNodeFileInfo | null {
	if (value === null) {
		return null
	}
	if (!isRecord(value) || !isRecord(value.tx)) {
		throw malformed("FileInfo")
	}

	return {
		finalized: requireBoolean(value.finalized, "FileInfo finalized"),
		isCached: requireBoolean(value.isCached, "FileInfo isCached"),
		pruned: value.pruned === undefined ? false : requireBoolean(value.pruned, "FileInfo pruned"),
		tx: {
			dataMerkleRoot: requireHash(value.tx.dataMerkleRoot, "FileInfo dataMerkleRoot"),
			seq: requireSafeInteger(value.tx.seq, "FileInfo seq"),
			size: requireSafeInteger(value.tx.size, "FileInfo size"),
			startEntryIndex: requireBigInt(value.tx.startEntryIndex, "FileInfo startEntryIndex"),
		},
		uploadedSegNum: requireSafeInteger(value.uploadedSegNum, "FileInfo uploadedSegNum"),
	}
}

export class HttpStorageNodeClient implements StorageNodeClient {
	readonly url: string
	readonly #fetch: Fetch
	readonly #timeoutMs: number
	#requestId = 0

	constructor(url: string, options: HttpStorageNodeClientOptions = {}) {
		this.url = url
		this.#fetch = options.fetch ?? globalThis.fetch
		this.#timeoutMs = options.timeoutMs ?? STORAGE_NODE_TIMEOUT_MS
	}

	async getStatus(): Promise<StorageNodeStatus> {
		return parseStatus(await this.#request("zgs_getStatus", []))
	}

	async getShardConfig(): Promise<StorageShardConfig> {
		return parseShardConfig(await this.#request("zgs_getShardConfig", []))
	}

	async getFileInfo(root: Hex, needAvailable: boolean): Promise<StorageNodeFileInfo | null> {
		requireHash(root, "root")
		return parseFileInfo(await this.#request("zgs_getFileInfo", [root, needAvailable]))
	}

	async getFileInfoByTxSeq(txSeq: number): Promise<StorageNodeFileInfo | null> {
		requireArgumentInteger(txSeq, "txSeq")
		return parseFileInfo(await this.#request("zgs_getFileInfoByTxSeq", [txSeq]))
	}

	async uploadSegmentsByTxSeq(segments: readonly StorageSegmentWithProof[], txSeq: number): Promise<number> {
		requireArgumentInteger(txSeq, "txSeq")
		return requireSafeInteger(await this.#request("zgs_uploadSegmentsByTxSeq", [segments, txSeq]), "upload result")
	}

	async downloadSegmentByTxSeq(txSeq: number, startChunk: number, endChunk: number): Promise<string> {
		requireArgumentInteger(txSeq, "txSeq")
		requireArgumentInteger(startChunk, "startChunk")
		requireArgumentInteger(endChunk, "endChunk")
		if (endChunk <= startChunk) {
			throw new StorageNodeRpcError("INVALID_ARGUMENT", "endChunk must be greater than startChunk")
		}
		const result = await this.#request("zgs_downloadSegmentByTxSeq", [txSeq, startChunk, endChunk])
		if (typeof result !== "string") {
			throw malformed("download Segment")
		}
		return result
	}

	async #request(method: string, params: readonly unknown[]): Promise<unknown> {
		const id = ++this.#requestId
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), this.#timeoutMs)
		let response: Response

		try {
			response = await this.#fetch(this.url, {
				body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST",
				signal: controller.signal,
			})
		} catch (cause) {
			if (controller.signal.aborted) {
				throw new StorageNodeRpcError("TIMEOUT", `Storage Node RPC ${method} timed out`, { cause })
			}
			throw new StorageNodeRpcError("NETWORK_ERROR", `Storage Node RPC ${method} is unavailable`, { cause })
		} finally {
			clearTimeout(timeout)
		}

		if (!response.ok) {
			throw new StorageNodeRpcError("HTTP_ERROR", `Storage Node RPC ${method} returned HTTP ${response.status}`)
		}

		let payload: JsonRpcSuccess | JsonRpcFailure
		try {
			payload = (await response.json()) as JsonRpcSuccess | JsonRpcFailure
		} catch (cause) {
			throw new StorageNodeRpcError("MALFORMED_RESPONSE", `Storage Node RPC ${method} returned invalid JSON`, {
				cause,
			})
		}

		if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== id) {
			throw malformed(`${method} envelope`)
		}
		if ("error" in payload) {
			if (
				!isRecord(payload.error) ||
				typeof payload.error.code !== "number" ||
				typeof payload.error.message !== "string"
			) {
				throw malformed(`${method} error`)
			}
			throw new StorageNodeRpcError(
				"RPC_ERROR",
				`Storage Node RPC ${method} failed (${payload.error.code}): ${payload.error.message}`,
			)
		}
		if (!("result" in payload)) {
			throw malformed(`${method} result`)
		}
		return payload.result
	}
}

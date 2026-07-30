import type { Address, Hex } from "viem"

export type StoragePocErrorCode =
	| "EMPTY_FILE"
	| "FILE_TOO_LARGE"
	| "HTTP_ERROR"
	| "INVALID_ARGUMENT"
	| "MALFORMED_RESPONSE"
	| "NETWORK_ERROR"
	| "NO_HEALTHY_NODE"
	| "RPC_ERROR"
	| "SDK_ERROR"
	| "TIMEOUT"

export class StoragePocError extends Error {
	readonly code: StoragePocErrorCode

	constructor(code: StoragePocErrorCode, message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = "StoragePocError"
		this.code = code
	}

	toJSON(): { code: StoragePocErrorCode; message: string; name: string } {
		return {
			code: this.code,
			message: this.message,
			name: this.name,
		}
	}
}

export interface StorageNetworkIdentity {
	readonly chainId: number
	readonly flowAddress: Address
	readonly p2pProtocolVersion: {
		readonly build: number
		readonly major: number
		readonly minor: number
	}
}

export interface StorageNodeStatus {
	readonly connectedPeers: number
	readonly logSyncBlock: Hex
	readonly logSyncHeight: bigint
	readonly networkIdentity: StorageNetworkIdentity
	readonly nextTxSeq: number
}

export interface StorageShardConfig {
	readonly numShard: number
	readonly shardId: number
}

export interface StorageNodeFileInfo {
	readonly finalized: boolean
	readonly isCached: boolean
	readonly pruned: boolean
	readonly tx: {
		readonly dataMerkleRoot: Hex
		readonly seq: number
		readonly size: number
		readonly startEntryIndex: bigint
	}
	readonly uploadedSegNum: number
}

export interface StorageSegmentProof {
	readonly lemma: readonly Hex[]
	readonly path: readonly boolean[]
}

export interface StorageSegmentWithProof {
	readonly data: string
	readonly fileSize: number
	readonly index: number
	readonly proof: StorageSegmentProof
	readonly root: Hex
}

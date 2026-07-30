import type { Address, Hex } from "viem"

export type StorageUploadPhase =
	| "awaiting-wallet"
	| "blocked-error"
	| "completed"
	| "downloading-for-verification"
	| "idle"
	| "paused"
	| "preparing"
	| "ready"
	| "recoverable-error"
	| "transaction-pending"
	| "uploading"
	| "verifying-node"
	| "waiting-node-sync"

export interface StorageUploadSession {
	readonly account: Address
	readonly confirmedSegmentIndexes: readonly number[]
	readonly createdAt: number
	readonly errorCode?: string
	readonly fileName: string
	readonly fileSize: number
	readonly id: string
	readonly identity?: Hex
	readonly nodeUrl?: string
	readonly phase: StorageUploadPhase
	readonly root?: Hex
	readonly schemaVersion: 1
	readonly totalSegments?: number
	readonly txHash?: Hex
	readonly txSeq?: number
	readonly updatedAt: number
}

export type StorageUploadSessionAction =
	| { readonly type: "completed" }
	| {
			readonly confirmedSegmentIndexes: readonly number[]
			readonly type: "upload-progress"
	  }
	| { readonly type: "node-verified" }
	| { readonly nodeUrl: string; readonly type: "node-synchronized" }
	| {
			readonly identity: Hex
			readonly root: Hex
			readonly totalSegments: number
			readonly type: "prepared"
	  }
	| { readonly type: "resume" }
	| { readonly errorCode: string; readonly type: "recoverable-error" }
	| { readonly type: "transaction-started" }
	| {
			readonly txHash: Hex
			readonly txSeq: number
			readonly type: "transaction-confirmed"
	  }
	| { readonly type: "verification-download-started" }
	| { readonly type: "wallet-requested" }

export interface CreateStorageUploadSessionInput {
	readonly account: Address
	readonly fileName: string
	readonly fileSize: number
	readonly id: string
	readonly now?: number
}

export function createStorageUploadSession({
	account,
	fileName,
	fileSize,
	id,
	now = Date.now(),
}: CreateStorageUploadSessionInput): StorageUploadSession {
	return {
		account,
		confirmedSegmentIndexes: [],
		createdAt: now,
		fileName,
		fileSize,
		id,
		phase: "preparing",
		schemaVersion: 1,
		updatedAt: now,
	}
}

function requirePhase(
	session: StorageUploadSession,
	action: StorageUploadSessionAction["type"],
	allowed: readonly StorageUploadPhase[],
): void {
	if (!allowed.includes(session.phase)) {
		throw new TypeError(`Cannot transition from ${session.phase} with ${action}`)
	}
}

function updateSession(session: StorageUploadSession, patch: Partial<StorageUploadSession>): StorageUploadSession {
	return {
		...session,
		...patch,
		updatedAt: Date.now(),
	}
}

export function reduceStorageUploadSession(
	session: StorageUploadSession,
	action: StorageUploadSessionAction,
): StorageUploadSession {
	switch (action.type) {
		case "prepared":
			requirePhase(session, action.type, ["preparing"])
			return updateSession(session, {
				identity: action.identity,
				phase: "ready",
				root: action.root,
				totalSegments: action.totalSegments,
			})
		case "wallet-requested":
			requirePhase(session, action.type, ["ready"])
			return updateSession(session, { phase: "awaiting-wallet" })
		case "transaction-started":
			requirePhase(session, action.type, ["awaiting-wallet"])
			return updateSession(session, { phase: "transaction-pending" })
		case "transaction-confirmed":
			requirePhase(session, action.type, ["transaction-pending"])
			return updateSession(session, {
				phase: "waiting-node-sync",
				txHash: action.txHash,
				txSeq: action.txSeq,
			})
		case "node-synchronized":
			requirePhase(session, action.type, ["waiting-node-sync"])
			return updateSession(session, {
				nodeUrl: action.nodeUrl,
				phase: "uploading",
			})
		case "upload-progress":
			requirePhase(session, action.type, ["uploading"])
			return updateSession(session, {
				confirmedSegmentIndexes: [...new Set(action.confirmedSegmentIndexes)].sort((left, right) => left - right),
			})
		case "node-verified":
			requirePhase(session, action.type, ["uploading"])
			return updateSession(session, { phase: "verifying-node" })
		case "verification-download-started":
			requirePhase(session, action.type, ["verifying-node"])
			return updateSession(session, { phase: "downloading-for-verification" })
		case "completed":
			requirePhase(session, action.type, ["downloading-for-verification"])
			return updateSession(session, {
				errorCode: undefined,
				phase: "completed",
			})
		case "recoverable-error":
			requirePhase(session, action.type, [
				"awaiting-wallet",
				"transaction-pending",
				"waiting-node-sync",
				"uploading",
				"verifying-node",
				"downloading-for-verification",
			])
			return updateSession(session, {
				errorCode: action.errorCode,
				phase: "recoverable-error",
			})
		case "resume":
			requirePhase(session, action.type, ["paused", "recoverable-error"])
			if (session.txHash !== undefined && session.txSeq !== undefined) {
				return updateSession(session, {
					errorCode: undefined,
					phase: "waiting-node-sync",
				})
			}
			if (session.root !== undefined) {
				return updateSession(session, {
					errorCode: undefined,
					phase: "ready",
				})
			}
			return updateSession(session, {
				errorCode: undefined,
				phase: "preparing",
			})
	}
}

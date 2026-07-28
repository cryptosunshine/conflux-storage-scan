import { type Hex, isAddress, isHex } from "viem"
import type { CanonicalChunk, StorageRepository } from "../../data/indexed-db/storage-db"
import { FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK, REORG_LOOKBACK_BLOCKS } from "../config"
import { NormalizeSubmitLogError, normalizeSubmitLog, type SubmitLogInput } from "../normalize/normalize-submit-log"
import { type DeploymentIdentity, DeploymentVerificationError } from "../proxy/verify-deployment"
import type { StorageSubmission } from "../types"
import { AdaptiveRangeError, type BlockRange, scanAdaptiveRanges } from "./adaptive-ranges"

const DEFAULT_MINIMUM_BLOCK_SPAN = 1_000n
const DEFAULT_INITIAL_BLOCK_SPAN = 100_000n
const DEFAULT_MAXIMUM_BLOCK_SPAN = 500_000n

export interface SyncSubmitLog extends SubmitLogInput {
	readonly removed?: boolean
}

export interface CanonicalHead {
	readonly number: bigint
	readonly hash: Hex
}

export interface TimestampedBlock {
	readonly number: bigint
	readonly hash: Hex
	readonly timestamp: bigint
}

export interface StorageSyncTransport {
	verifyDeployment(signal?: AbortSignal): Promise<DeploymentIdentity>
	getHeadBlock(signal?: AbortSignal): Promise<CanonicalHead>
	getSubmitLogs(range: BlockRange, signal?: AbortSignal): Promise<readonly SyncSubmitLog[]>
	getBlock(blockNumber: bigint, signal?: AbortSignal): Promise<TimestampedBlock>
}

export interface RpcFailure {
	readonly code: string
	readonly message: string
}

export interface DeploymentFailure extends RpcFailure {
	readonly code:
		| "CHAIN_ID_MISMATCH"
		| "PROXY_CODE_MISSING"
		| "BEACON_MISMATCH"
		| "BEACON_CODE_MISSING"
		| "IMPLEMENTATION_MISMATCH"
		| "MARKET_MISMATCH"
}

export type SyncState =
	| { readonly status: "idle" }
	| {
			readonly status: "syncing"
			readonly fromBlock: bigint
			readonly toBlock: bigint
	  }
	| {
			readonly status: "fresh"
			readonly headBlock: bigint
			readonly syncedAt: number
	  }
	| {
			readonly status: "stale"
			readonly lastSuccessAt: number
			readonly error: RpcFailure
	  }
	| {
			readonly status: "partial"
			readonly lastSuccessAt?: number
			readonly gaps: readonly bigint[]
			readonly error: RpcFailure
	  }
	| {
			readonly status: "incompatible-contract"
			readonly error: DeploymentFailure
	  }

export interface SubmissionSyncService {
	sync(signal?: AbortSignal): Promise<SyncState>
	getState(): SyncState
}

export interface CreateSubmissionSyncServiceOptions {
	readonly repository: StorageRepository
	readonly transport: StorageSyncTransport
	readonly now?: () => number
	readonly ranges?: {
		readonly minimumSpan?: bigint
		readonly initialSpan?: bigint
		readonly maximumSpan?: bigint
		readonly maximumRetries?: number
		readonly baseRetryDelayMs?: number
		readonly jitter?: (baseDelayMs: number) => number
		readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
	}
}

function errorCode(error: unknown, fallback: string): string {
	if (error && typeof error === "object" && "code" in error) {
		const value = error.code
		if (typeof value === "string") {
			return value
		}
	}
	return fallback
}

function failureFrom(error: unknown, fallbackCode: string): RpcFailure {
	return {
		code: errorCode(error, fallbackCode),
		message: error instanceof Error ? error.message : "Unknown sync failure",
	}
}

function isDeploymentFailure(error: unknown): error is DeploymentVerificationError {
	return error instanceof DeploymentVerificationError
}

function rawLogKey(log: SyncSubmitLog): string {
	if (
		!log.address ||
		!isAddress(log.address) ||
		!log.blockHash ||
		!isHex(log.blockHash, { strict: true }) ||
		!log.transactionHash ||
		!isHex(log.transactionHash, { strict: true }) ||
		log.logIndex === undefined ||
		log.logIndex === null ||
		!Number.isSafeInteger(log.logIndex) ||
		log.logIndex < 0
	) {
		throw Object.assign(new Error("Submit log identity fields are malformed"), {
			code: "MALFORMED_SUBMIT",
		})
	}
	return [log.address.toLowerCase(), log.blockHash.toLowerCase(), log.transactionHash.toLowerCase(), log.logIndex].join(
		":",
	)
}

function activeLogs(logs: readonly SyncSubmitLog[]): readonly SyncSubmitLog[] {
	const active = new Map<string, SyncSubmitLog>()
	for (const log of logs) {
		const key = rawLogKey(log)
		if (log.removed) {
			active.delete(key)
		} else {
			active.set(key, log)
		}
	}
	return [...active.values()]
}

function compareLogs(left: SyncSubmitLog, right: SyncSubmitLog): number {
	const leftBlock = left.blockNumber ?? -1n
	const rightBlock = right.blockNumber ?? -1n
	if (leftBlock !== rightBlock) {
		return leftBlock < rightBlock ? -1 : 1
	}
	const leftTransaction = left.transactionIndex ?? -1
	const rightTransaction = right.transactionIndex ?? -1
	if (leftTransaction !== rightTransaction) {
		return leftTransaction - rightTransaction
	}
	return (left.logIndex ?? -1) - (right.logIndex ?? -1)
}

async function timestampForLog(
	log: SyncSubmitLog,
	transport: StorageSyncTransport,
	cache: Map<Hex, bigint>,
	signal?: AbortSignal,
): Promise<bigint | number | Hex | undefined> {
	if (log.blockTimestamp !== undefined) {
		return log.blockTimestamp
	}
	if (log.blockNumber === undefined || log.blockNumber === null || !log.blockHash) {
		throw Object.assign(new Error("Submit log block identity is incomplete"), {
			code: "MALFORMED_SUBMIT",
		})
	}

	const cached = cache.get(log.blockHash)
	if (cached !== undefined) {
		return cached
	}
	const block = await transport.getBlock(log.blockNumber, signal)
	if (
		block.number !== log.blockNumber ||
		block.hash.toLowerCase() !== log.blockHash.toLowerCase() ||
		block.timestamp < 0n
	) {
		throw Object.assign(new Error("Block timestamp response does not match the Submit log"), {
			code: "INVALID_BLOCK_TIMESTAMP",
		})
	}
	cache.set(log.blockHash, block.timestamp)
	return block.timestamp
}

async function normalizeLogs(
	logs: readonly SyncSubmitLog[],
	identity: DeploymentIdentity,
	transport: StorageSyncTransport,
	signal?: AbortSignal,
): Promise<readonly StorageSubmission[]> {
	const timestampCache = new Map<Hex, bigint>()
	const normalized: StorageSubmission[] = []
	for (const log of [...activeLogs(logs)].sort(compareLogs)) {
		normalized.push(
			normalizeSubmitLog(log, {
				blockTimestamp: await timestampForLog(log, transport, timestampCache, signal),
				implementationAddress: identity.implementation,
			}),
		)
	}

	const byCanonicalKey = new Map(normalized.map((submission) => [submission.canonicalKey, submission]))
	return [...byCanonicalKey.values()].sort((left, right) =>
		left.sequence === right.sequence
			? left.canonicalKey.localeCompare(right.canonicalKey)
			: left.sequence < right.sequence
				? -1
				: 1,
	)
}

function sequenceGaps(submissions: readonly StorageSubmission[], includeGenesis: boolean): readonly bigint[] {
	if (submissions.length === 0) {
		return []
	}

	const gaps: bigint[] = []
	const seen = new Map<string, string>()
	for (const submission of submissions) {
		const sequence = submission.sequence.toString(10)
		const existing = seen.get(sequence)
		if (existing && existing !== submission.canonicalKey) {
			throw Object.assign(new Error(`Sequence ${sequence} has multiple canonical records`), {
				code: "DUPLICATE_SEQUENCE",
			})
		}
		seen.set(sequence, submission.canonicalKey)
	}

	const first = submissions[0]
	const last = submissions.at(-1)
	if (!first || !last) {
		return gaps
	}
	const start = includeGenesis ? 0n : first.sequence
	for (let sequence = start; sequence <= last.sequence; sequence += 1n) {
		if (!seen.has(sequence.toString(10))) {
			gaps.push(sequence)
		}
	}
	return gaps
}

function canonicalChunk(
	fromBlock: bigint,
	head: CanonicalHead,
	submissions: readonly StorageSubmission[],
): CanonicalChunk {
	const canonicalBlockHashes = new Map<bigint, Hex>()
	for (const submission of submissions) {
		const existing = canonicalBlockHashes.get(submission.blockNumber)
		if (existing && existing.toLowerCase() !== submission.blockHash.toLowerCase()) {
			throw Object.assign(new Error(`Block ${submission.blockNumber} has conflicting hashes`), {
				code: "BLOCK_HASH_CONFLICT",
			})
		}
		canonicalBlockHashes.set(submission.blockNumber, submission.blockHash)
	}
	const existingHead = canonicalBlockHashes.get(head.number)
	if (existingHead && existingHead.toLowerCase() !== head.hash.toLowerCase()) {
		throw Object.assign(new Error(`Head block ${head.number} hash conflicts with its logs`), {
			code: "BLOCK_HASH_CONFLICT",
		})
	}
	canonicalBlockHashes.set(head.number, head.hash)
	return {
		canonicalBlockHashes,
		fromBlock,
		submissions,
		toBlock: head.number,
	}
}

class DefaultSubmissionSyncService implements SubmissionSyncService {
	readonly #options: CreateSubmissionSyncServiceOptions
	#state: SyncState = { status: "idle" }
	#lastSuccessAt: number | undefined

	constructor(options: CreateSubmissionSyncServiceOptions) {
		this.#options = options
	}

	getState(): SyncState {
		return this.#state
	}

	#failureState(error: unknown, fallbackCode: string): SyncState {
		const failure = failureFrom(error, fallbackCode)
		if (this.#lastSuccessAt !== undefined) {
			return {
				status: "stale",
				lastSuccessAt: this.#lastSuccessAt,
				error: failure,
			}
		}
		return {
			status: "partial",
			gaps: [],
			error: failure,
		}
	}

	#partialState(error: unknown, fallbackCode: string, gaps: readonly bigint[] = []): SyncState {
		return {
			status: "partial",
			...(this.#lastSuccessAt === undefined ? {} : { lastSuccessAt: this.#lastSuccessAt }),
			gaps,
			error: failureFrom(error, fallbackCode),
		}
	}

	async sync(signal?: AbortSignal): Promise<SyncState> {
		let identity: DeploymentIdentity
		try {
			identity = await this.#options.transport.verifyDeployment(signal)
		} catch (error) {
			if (isDeploymentFailure(error)) {
				this.#state = {
					status: "incompatible-contract",
					error: {
						code: error.code,
						message: error.message,
					},
				}
				return this.#state
			}
			this.#state = this.#failureState(error, "DEPLOYMENT_VERIFY_FAILED")
			return this.#state
		}

		let head: CanonicalHead
		let checkpoint: Awaited<ReturnType<StorageRepository["getCheckpoint"]>>
		try {
			;[head, checkpoint] = await Promise.all([
				this.#options.transport.getHeadBlock(signal),
				this.#options.repository.getCheckpoint(),
			])
		} catch (error) {
			this.#state = this.#failureState(error, "SYNC_PREPARE_FAILED")
			return this.#state
		}

		const overlapStart =
			checkpoint === undefined
				? FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK
				: checkpoint.blockNumber - (REORG_LOOKBACK_BLOCKS - 1n)
		const fromBlock =
			overlapStart < FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK ? FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK : overlapStart
		this.#state = {
			status: "syncing",
			fromBlock,
			toBlock: head.number,
		}

		let logs: readonly SyncSubmitLog[]
		try {
			logs = await scanAdaptiveRanges({
				baseRetryDelayMs: this.#options.ranges?.baseRetryDelayMs,
				fetchRange: (range, currentSignal) => this.#options.transport.getSubmitLogs(range, currentSignal),
				fromBlock,
				initialSpan: this.#options.ranges?.initialSpan ?? DEFAULT_INITIAL_BLOCK_SPAN,
				jitter: this.#options.ranges?.jitter,
				maximumRetries: this.#options.ranges?.maximumRetries,
				maximumSpan: this.#options.ranges?.maximumSpan ?? DEFAULT_MAXIMUM_BLOCK_SPAN,
				minimumSpan: this.#options.ranges?.minimumSpan ?? DEFAULT_MINIMUM_BLOCK_SPAN,
				signal,
				sleep: this.#options.ranges?.sleep,
				toBlock: head.number,
			})
		} catch (error) {
			if (error instanceof AdaptiveRangeError && error.code === "ABORTED") {
				throw error
			}
			this.#state =
				errorCode(error, "") === "PARTIAL_BATCH"
					? this.#partialState(error, "PARTIAL_BATCH")
					: this.#failureState(error, "LOG_SYNC_FAILED")
			return this.#state
		}

		try {
			const submissions = await normalizeLogs(logs, identity, this.#options.transport, signal)
			const gaps = sequenceGaps(submissions, fromBlock === FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK)
			if (gaps.length > 0) {
				this.#state = this.#partialState(
					{
						code: "SEQUENCE_GAP",
						message: `Missing submission sequences: ${gaps.join(", ")}`,
					},
					"SEQUENCE_GAP",
					gaps,
				)
				return this.#state
			}

			await this.#options.repository.reconcileWindow(canonicalChunk(fromBlock, head, submissions))
		} catch (error) {
			if (error instanceof NormalizeSubmitLogError) {
				this.#state = this.#partialState(error, "MALFORMED_SUBMIT")
				return this.#state
			}
			this.#state = this.#failureState(error, "NORMALIZATION_FAILED")
			return this.#state
		}

		const syncedAt = (this.#options.now ?? Date.now)()
		this.#lastSuccessAt = syncedAt
		this.#state = {
			status: "fresh",
			headBlock: head.number,
			syncedAt,
		}
		return this.#state
	}
}

export function createSubmissionSyncService(options: CreateSubmissionSyncServiceOptions): SubmissionSyncService {
	return new DefaultSubmissionSyncService(options)
}

export async function syncSubmissions(
	options: CreateSubmissionSyncServiceOptions,
	signal?: AbortSignal,
): Promise<SyncState> {
	return createSubmissionSyncService(options).sync(signal)
}

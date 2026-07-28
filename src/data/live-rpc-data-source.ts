import type { PublicClient } from "viem"
import { fixedPriceFlowAbi } from "../chain/abi/fixed-price-flow"
import { FIXED_PRICE_FLOW_PROXY, STORAGE_FEE_CFX, STORAGE_SECTOR_BYTES } from "../chain/config"
import { verifyDeployment } from "../chain/proxy/verify-deployment"
import {
	createSubmissionSyncService,
	type StorageSyncTransport,
	type SubmissionSyncService,
	type SyncState,
	type SyncSubmitLog,
} from "../chain/sync/sync-submissions"
import type { StorageSubmission } from "../chain/types"
import type { Page, StorageRepository } from "./indexed-db/storage-db"
import {
	type AddressListSubmissionsQuery,
	type ListSubmissionsQuery,
	normalizeSubmitterAddress,
	type StorageDataSource,
	type StorageSummary,
} from "./storage-data-source"

export interface CreateLiveRpcDataSourceOptions {
	readonly client: PublicClient
	readonly repository: StorageRepository
	readonly transport: StorageSyncTransport
}

export class LocalIndexError extends Error {
	readonly code = "CACHE_CORRUPT"

	constructor(cause: unknown) {
		super("The local storage index could not be read. Rebuild the browser index to recover.", { cause })
		this.name = "LocalIndexError"
	}
}

function isLocalIndexCorruption(error: unknown): boolean {
	if (error instanceof SyntaxError) {
		return true
	}
	return (
		error instanceof DOMException &&
		["ConstraintError", "DataError", "InvalidStateError", "NotFoundError", "VersionError"].includes(error.name)
	)
}

async function guardLocalIndex<Result>(operation: () => Promise<Result>): Promise<Result> {
	try {
		return await operation()
	} catch (error) {
		if (isLocalIndexCorruption(error)) {
			throw new LocalIndexError(error)
		}
		throw error
	}
}

function guardedRepository(repository: StorageRepository): StorageRepository {
	return {
		namespace: repository.namespace,
		applyChunk: (chunk) => guardLocalIndex(() => repository.applyChunk(chunk)),
		clearCurrentNamespace: () => repository.clearCurrentNamespace(),
		getByCanonicalKey: (canonicalKey) => guardLocalIndex(() => repository.getByCanonicalKey(canonicalKey)),
		getBySequence: (sequence) => guardLocalIndex(() => repository.getBySequence(sequence)),
		getBlockTimestamp: (blockHash) => guardLocalIndex(() => repository.getBlockTimestamp(blockHash)),
		getCheckpoint: () => guardLocalIndex(() => repository.getCheckpoint()),
		getSubmitterSummary: (submitter) => guardLocalIndex(() => repository.getSubmitterSummary(submitter)),
		getSummary: () => guardLocalIndex(() => repository.getSummary()),
		list: (query) => guardLocalIndex(() => repository.list(query)),
		listBySubmitter: (query) => guardLocalIndex(() => repository.listBySubmitter(query)),
		reconcileWindow: (chunk) => guardLocalIndex(() => repository.reconcileWindow(chunk)),
	}
}

function assertActive(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new DOMException("The operation was aborted", "AbortError")
	}
}

function requireBlockIdentity(block: Awaited<ReturnType<PublicClient["getBlock"]>>): {
	readonly hash: `0x${string}`
	readonly number: bigint
	readonly timestamp: bigint
} {
	if (!block.hash || block.number === null) {
		throw new TypeError("RPC block is pending or missing its canonical identity")
	}
	return {
		hash: block.hash,
		number: block.number,
		timestamp: block.timestamp,
	}
}

export function createViemStorageSyncTransport(client: PublicClient): StorageSyncTransport {
	return {
		verifyDeployment: async (signal) => {
			assertActive(signal)
			const identity = await verifyDeployment(client)
			assertActive(signal)
			return identity
		},
		getHeadBlock: async (signal) => {
			assertActive(signal)
			const blockNumber = await client.getBlockNumber()
			const block = requireBlockIdentity(await client.getBlock({ blockNumber, includeTransactions: false }))
			assertActive(signal)
			return {
				hash: block.hash,
				number: block.number,
			}
		},
		getSubmitLogs: async (range, signal) => {
			assertActive(signal)
			const logs = await client.getLogs({
				address: FIXED_PRICE_FLOW_PROXY,
				event: fixedPriceFlowAbi[0],
				fromBlock: range.fromBlock,
				strict: true,
				toBlock: range.toBlock,
			})
			assertActive(signal)
			return logs.map((log) => {
				const enriched = log as typeof log & {
					readonly blockTimestamp?: SyncSubmitLog["blockTimestamp"]
					readonly transactionLogIndex?: number
				}
				return {
					address: log.address,
					args: log.args,
					blockHash: log.blockHash,
					blockNumber: log.blockNumber,
					...(enriched.blockTimestamp === undefined ? {} : { blockTimestamp: enriched.blockTimestamp }),
					logIndex: log.logIndex,
					removed: log.removed,
					transactionHash: log.transactionHash,
					transactionIndex: log.transactionIndex,
					...(enriched.transactionLogIndex === undefined ? {} : { transactionLogIndex: enriched.transactionLogIndex }),
				}
			})
		},
		getBlock: async (blockNumber, signal) => {
			assertActive(signal)
			const block = requireBlockIdentity(await client.getBlock({ blockNumber, includeTransactions: false }))
			assertActive(signal)
			return block
		},
	}
}

class LiveRpcStorageDataSource implements StorageDataSource {
	readonly #options: CreateLiveRpcDataSourceOptions
	#syncService: SubmissionSyncService

	constructor(options: CreateLiveRpcDataSourceOptions) {
		this.#options = options
		this.#syncService = this.#createSyncService()
	}

	#createSyncService(): SubmissionSyncService {
		return createSubmissionSyncService({
			repository: guardedRepository(this.#options.repository),
			transport: this.#options.transport,
		})
	}

	sync(signal?: AbortSignal): Promise<SyncState> {
		return this.#syncService.sync(signal)
	}

	getSyncState(): SyncState {
		return this.#syncService.getState()
	}

	async getSummary(): Promise<StorageSummary> {
		const indexed = await guardLocalIndex(() => this.#options.repository.getSummary())
		let contractSubmissionCount = indexed.indexedSubmissionCount
		let allocatedSectorCount = indexed.indexedAllocatedSectorCount
		try {
			await this.#options.transport.verifyDeployment()
			const [liveSubmissionCount, tree] = await Promise.all([
				this.#options.client.readContract({
					abi: fixedPriceFlowAbi,
					address: FIXED_PRICE_FLOW_PROXY,
					functionName: "submissionIndex",
				}),
				this.#options.client.readContract({
					abi: fixedPriceFlowAbi,
					address: FIXED_PRICE_FLOW_PROXY,
					functionName: "tree",
				}),
			])
			contractSubmissionCount = liveSubmissionCount
			allocatedSectorCount = tree[0]
		} catch {
			// The sync state reports the live failure; cached index metrics remain useful and internally consistent.
		}
		return {
			contractSubmissionCount,
			indexedSubmissionCount: indexed.indexedSubmissionCount,
			indexedLogicalBytes: indexed.indexedLogicalBytes,
			allocatedSectorCount,
			allocatedBytes: allocatedSectorCount * STORAGE_SECTOR_BYTES,
			storageFeeCfx: STORAGE_FEE_CFX,
			...(indexed.latestBlock === undefined ? {} : { latestBlock: indexed.latestBlock }),
		}
	}

	getSubmitterSummary(submitter: string) {
		return guardLocalIndex(() => this.#options.repository.getSubmitterSummary(normalizeSubmitterAddress(submitter)))
	}

	listSubmissions(query: ListSubmissionsQuery = {}): Promise<Page<StorageSubmission>> {
		return guardLocalIndex(() => this.#options.repository.list(query))
	}

	getSubmission(sequence: bigint): Promise<StorageSubmission | undefined> {
		return guardLocalIndex(() => this.#options.repository.getBySequence(sequence))
	}

	listBySubmitter(query: AddressListSubmissionsQuery): Promise<Page<StorageSubmission>> {
		return guardLocalIndex(() =>
			this.#options.repository.listBySubmitter({
				...query,
				submitter: normalizeSubmitterAddress(query.submitter),
			}),
		)
	}

	async rebuildLocalIndex(): Promise<void> {
		await this.#options.repository.clearCurrentNamespace()
		this.#syncService = this.#createSyncService()
	}
}

export function createLiveRpcDataSource(options: CreateLiveRpcDataSourceOptions): StorageDataSource {
	return new LiveRpcStorageDataSource(options)
}

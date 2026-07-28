import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb"
import { type Address, getAddress, type Hex, isAddressEqual } from "viem"
import { CONFLUX_ESPACE_TESTNET_CHAIN_ID, FIXED_PRICE_FLOW_PROXY } from "../../chain/config"
import type { StorageSubmission } from "../../chain/types"

const CHECKPOINT_META_KEY = "checkpoint"
const DEFAULT_PAGE_SIZE = 20
const MAXIMUM_PAGE_SIZE = 100

interface PersistedSubmission {
	readonly canonicalKey: string
	readonly chainId: typeof CONFLUX_ESPACE_TESTNET_CHAIN_ID
	readonly contractAddress: Address
	readonly implementationAddress: Address
	readonly sequence: string
	readonly submitter: Address
	readonly submitterIndex: string
	readonly submissionIdentity: Hex
	readonly logicalSizeBytes: string
	readonly startSector: string
	readonly sectorCount: string
	readonly endSectorExclusive: string
	readonly nodeRoots: readonly Hex[]
	readonly tags: Hex
	readonly blockNumber: string
	readonly blockHash: Hex
	readonly transactionHash: Hex
	readonly transactionIndex: number
	readonly logIndex: number
	readonly transactionLogIndex?: number
	readonly timestamp: number
}

interface PersistedBlock {
	readonly blockHash: Hex
	readonly blockNumber: string
}

interface PersistedMeta {
	readonly name: string
	readonly blockNumber: string
	readonly blockHash?: Hex
}

interface StorageDbSchema extends DBSchema {
	submissions: {
		key: string
		value: PersistedSubmission
		indexes: {
			blockNumber: string
			sequence: string
			submitter: string
		}
	}
	blocks: {
		key: Hex
		value: PersistedBlock
		indexes: {
			blockNumber: string
		}
	}
	meta: {
		key: string
		value: PersistedMeta
	}
}

export interface CanonicalChunk {
	readonly fromBlock: bigint
	readonly toBlock: bigint
	readonly canonicalBlockHashes: ReadonlyMap<bigint, Hex>
	readonly submissions: readonly StorageSubmission[]
}

export interface ListQuery {
	readonly page?: number
	readonly pageSize?: number
}

export interface AddressListQuery extends ListQuery {
	readonly submitter: Address
}

export interface Page<Item> {
	readonly items: readonly Item[]
	readonly page: number
	readonly pageSize: number
	readonly totalItems: number
	readonly totalPages: number
}

export interface IndexedSummary {
	readonly indexedSubmissionCount: bigint
	readonly indexedLogicalBytes: bigint
	readonly latestBlock?: bigint
}

export interface SyncCheckpoint {
	readonly blockNumber: bigint
	readonly blockHash?: Hex
}

export interface StorageRepository {
	readonly namespace: string
	applyChunk(chunk: CanonicalChunk): Promise<void>
	reconcileWindow(chunk: CanonicalChunk): Promise<void>
	list(query?: ListQuery): Promise<Page<StorageSubmission>>
	listBySubmitter(query: AddressListQuery): Promise<Page<StorageSubmission>>
	getByCanonicalKey(canonicalKey: string): Promise<StorageSubmission | undefined>
	getBySequence(sequence: bigint): Promise<StorageSubmission | undefined>
	getSummary(): Promise<IndexedSummary>
	getCheckpoint(): Promise<SyncCheckpoint | undefined>
	clearCurrentNamespace(): Promise<void>
}

export interface CreateStorageRepositoryOptions {
	readonly implementationAddress: Address
	readonly schemaVersion: number
	readonly normalizerVersion: string
	readonly databasePrefix?: string
}

export type StorageRepositoryErrorCode =
	| "CHUNK_RANGE_INVALID"
	| "SUBMISSION_OUTSIDE_CHUNK"
	| "BLOCK_HASH_MISMATCH"
	| "DUPLICATE_SEQUENCE"
	| "IMPLEMENTATION_MISMATCH"
	| "QUERY_INVALID"

export class StorageRepositoryError extends Error {
	readonly code: StorageRepositoryErrorCode

	constructor(code: StorageRepositoryErrorCode, message: string) {
		super(message)
		this.name = "StorageRepositoryError"
		this.code = code
	}
}

function toPersistedSubmission(submission: StorageSubmission): PersistedSubmission {
	return {
		canonicalKey: submission.canonicalKey,
		chainId: submission.chainId,
		contractAddress: submission.contractAddress,
		implementationAddress: submission.implementationAddress,
		sequence: submission.sequence.toString(10),
		submitter: submission.submitter,
		submitterIndex: submission.submitter.toLowerCase(),
		submissionIdentity: submission.submissionIdentity,
		logicalSizeBytes: submission.logicalSizeBytes.toString(10),
		startSector: submission.startSector.toString(10),
		sectorCount: submission.sectorCount.toString(10),
		endSectorExclusive: submission.endSectorExclusive.toString(10),
		nodeRoots: submission.nodeRoots,
		tags: submission.tags,
		blockNumber: submission.blockNumber.toString(10),
		blockHash: submission.blockHash,
		transactionHash: submission.transactionHash,
		transactionIndex: submission.transactionIndex,
		logIndex: submission.logIndex,
		...(submission.transactionLogIndex === undefined ? {} : { transactionLogIndex: submission.transactionLogIndex }),
		timestamp: submission.timestamp,
	}
}

function fromPersistedSubmission(submission: PersistedSubmission): StorageSubmission {
	return {
		canonicalKey: submission.canonicalKey,
		chainId: submission.chainId,
		contractAddress: getAddress(submission.contractAddress),
		implementationAddress: getAddress(submission.implementationAddress),
		sequence: BigInt(submission.sequence),
		submitter: getAddress(submission.submitter),
		submissionIdentity: submission.submissionIdentity,
		logicalSizeBytes: BigInt(submission.logicalSizeBytes),
		startSector: BigInt(submission.startSector),
		sectorCount: BigInt(submission.sectorCount),
		endSectorExclusive: BigInt(submission.endSectorExclusive),
		nodeRoots: submission.nodeRoots,
		tags: submission.tags,
		blockNumber: BigInt(submission.blockNumber),
		blockHash: submission.blockHash,
		transactionHash: submission.transactionHash,
		transactionIndex: submission.transactionIndex,
		logIndex: submission.logIndex,
		...(submission.transactionLogIndex === undefined ? {} : { transactionLogIndex: submission.transactionLogIndex }),
		timestamp: submission.timestamp,
	}
}

function validateChunk(chunk: CanonicalChunk): void {
	if (chunk.fromBlock < 0n || chunk.toBlock < chunk.fromBlock) {
		throw new StorageRepositoryError("CHUNK_RANGE_INVALID", "Canonical chunk block range is invalid")
	}

	const sequences = new Set<string>()
	for (const submission of chunk.submissions) {
		if (submission.blockNumber < chunk.fromBlock || submission.blockNumber > chunk.toBlock) {
			throw new StorageRepositoryError(
				"SUBMISSION_OUTSIDE_CHUNK",
				`Submission ${submission.sequence} is outside the chunk range`,
			)
		}
		const canonicalHash = chunk.canonicalBlockHashes.get(submission.blockNumber)
		if (!canonicalHash || canonicalHash.toLowerCase() !== submission.blockHash.toLowerCase()) {
			throw new StorageRepositoryError(
				"BLOCK_HASH_MISMATCH",
				`Submission ${submission.sequence} does not match the canonical block map`,
			)
		}
		const sequence = submission.sequence.toString(10)
		if (sequences.has(sequence)) {
			throw new StorageRepositoryError("DUPLICATE_SEQUENCE", `Chunk contains duplicate sequence ${sequence}`)
		}
		sequences.add(sequence)
	}
}

function checkpointForChunk(chunk: CanonicalChunk): PersistedMeta {
	const blockHash = chunk.canonicalBlockHashes.get(chunk.toBlock)
	return {
		name: CHECKPOINT_META_KEY,
		blockNumber: chunk.toBlock.toString(10),
		...(blockHash === undefined ? {} : { blockHash }),
	}
}

function normalizePageQuery(query: ListQuery = {}): {
	readonly page: number
	readonly pageSize: number
} {
	const page = query.page ?? 1
	const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
	if (
		!Number.isSafeInteger(page) ||
		page < 1 ||
		!Number.isSafeInteger(pageSize) ||
		pageSize < 1 ||
		pageSize > MAXIMUM_PAGE_SIZE
	) {
		throw new StorageRepositoryError(
			"QUERY_INVALID",
			`Page must be >= 1 and pageSize must be between 1 and ${MAXIMUM_PAGE_SIZE}`,
		)
	}
	return { page, pageSize }
}

function paginate(submissions: readonly PersistedSubmission[], query: ListQuery): Page<StorageSubmission> {
	const { page, pageSize } = normalizePageQuery(query)
	const sorted = [...submissions].sort((left, right) => {
		const leftSequence = BigInt(left.sequence)
		const rightSequence = BigInt(right.sequence)
		return leftSequence === rightSequence ? 0 : leftSequence > rightSequence ? -1 : 1
	})
	const totalItems = sorted.length
	const start = (page - 1) * pageSize
	return {
		items: sorted.slice(start, start + pageSize).map(fromPersistedSubmission),
		page,
		pageSize,
		totalItems,
		totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
	}
}

function createNamespace(options: CreateStorageRepositoryOptions): string {
	if (!Number.isSafeInteger(options.schemaVersion) || options.schemaVersion < 1 || !options.normalizerVersion) {
		throw new StorageRepositoryError("QUERY_INVALID", "Repository versions must be non-empty positive values")
	}
	const prefix = options.databasePrefix ?? "conflux-storage-scan"
	return [
		prefix,
		CONFLUX_ESPACE_TESTNET_CHAIN_ID,
		FIXED_PRICE_FLOW_PROXY.toLowerCase(),
		options.implementationAddress.toLowerCase(),
		`schema-${options.schemaVersion}`,
		`normalizer-${encodeURIComponent(options.normalizerVersion)}`,
	].join(":")
}

class IndexedDbStorageRepository implements StorageRepository {
	readonly namespace: string
	readonly #implementationAddress: Address
	#databasePromise: Promise<IDBPDatabase<StorageDbSchema>> | undefined

	constructor(options: CreateStorageRepositoryOptions) {
		this.namespace = createNamespace(options)
		this.#implementationAddress = getAddress(options.implementationAddress)
	}

	#database(): Promise<IDBPDatabase<StorageDbSchema>> {
		this.#databasePromise ??= openDB<StorageDbSchema>(this.namespace, 1, {
			upgrade(database) {
				const submissions = database.createObjectStore("submissions", {
					keyPath: "canonicalKey",
				})
				submissions.createIndex("sequence", "sequence", { unique: true })
				submissions.createIndex("submitter", "submitterIndex")
				submissions.createIndex("blockNumber", "blockNumber")

				const blocks = database.createObjectStore("blocks", {
					keyPath: "blockHash",
				})
				blocks.createIndex("blockNumber", "blockNumber")
				database.createObjectStore("meta", { keyPath: "name" })
			},
		})
		return this.#databasePromise
	}

	#validateChunk(chunk: CanonicalChunk): void {
		validateChunk(chunk)
		for (const submission of chunk.submissions) {
			if (!isAddressEqual(submission.implementationAddress, this.#implementationAddress)) {
				throw new StorageRepositoryError(
					"IMPLEMENTATION_MISMATCH",
					"Submission implementation does not match the repository namespace",
				)
			}
		}
	}

	async applyChunk(chunk: CanonicalChunk): Promise<void> {
		this.#validateChunk(chunk)
		const database = await this.#database()
		const transaction = database.transaction(["submissions", "blocks", "meta"], "readwrite")
		for (const [blockNumber, blockHash] of chunk.canonicalBlockHashes) {
			await transaction.objectStore("blocks").put({
				blockHash,
				blockNumber: blockNumber.toString(10),
			})
		}
		for (const submission of chunk.submissions) {
			await transaction.objectStore("submissions").put(toPersistedSubmission(submission))
		}
		await transaction.objectStore("meta").put(checkpointForChunk(chunk))
		await transaction.done
	}

	async reconcileWindow(chunk: CanonicalChunk): Promise<void> {
		this.#validateChunk(chunk)
		const database = await this.#database()
		const transaction = database.transaction(["submissions", "blocks", "meta"], "readwrite")
		const submissionStore = transaction.objectStore("submissions")
		const incomingKeys = new Set(chunk.submissions.map((submission) => submission.canonicalKey))
		for (const persisted of await submissionStore.getAll()) {
			const blockNumber = BigInt(persisted.blockNumber)
			if (blockNumber >= chunk.fromBlock && blockNumber <= chunk.toBlock && !incomingKeys.has(persisted.canonicalKey)) {
				await submissionStore.delete(persisted.canonicalKey)
			}
		}

		const blockStore = transaction.objectStore("blocks")
		for (const persisted of await blockStore.getAll()) {
			const blockNumber = BigInt(persisted.blockNumber)
			if (blockNumber >= chunk.fromBlock && blockNumber <= chunk.toBlock) {
				await blockStore.delete(persisted.blockHash)
			}
		}
		for (const [blockNumber, blockHash] of chunk.canonicalBlockHashes) {
			await blockStore.put({
				blockHash,
				blockNumber: blockNumber.toString(10),
			})
		}
		for (const submission of chunk.submissions) {
			await submissionStore.put(toPersistedSubmission(submission))
		}
		await transaction.objectStore("meta").put(checkpointForChunk(chunk))
		await transaction.done
	}

	async list(query: ListQuery = {}): Promise<Page<StorageSubmission>> {
		const database = await this.#database()
		return paginate(await database.getAll("submissions"), query)
	}

	async listBySubmitter(query: AddressListQuery): Promise<Page<StorageSubmission>> {
		const database = await this.#database()
		const submissions = await database.getAllFromIndex("submissions", "submitter", query.submitter.toLowerCase())
		return paginate(submissions, query)
	}

	async getByCanonicalKey(canonicalKey: string): Promise<StorageSubmission | undefined> {
		const database = await this.#database()
		const submission = await database.get("submissions", canonicalKey)
		return submission ? fromPersistedSubmission(submission) : undefined
	}

	async getBySequence(sequence: bigint): Promise<StorageSubmission | undefined> {
		const database = await this.#database()
		const submission = await database.getFromIndex("submissions", "sequence", sequence.toString(10))
		return submission ? fromPersistedSubmission(submission) : undefined
	}

	async getSummary(): Promise<IndexedSummary> {
		const database = await this.#database()
		const [submissions, checkpoint] = await Promise.all([
			database.getAll("submissions"),
			database.get("meta", CHECKPOINT_META_KEY),
		])
		return {
			indexedSubmissionCount: BigInt(submissions.length),
			indexedLogicalBytes: submissions.reduce((total, submission) => total + BigInt(submission.logicalSizeBytes), 0n),
			...(checkpoint ? { latestBlock: BigInt(checkpoint.blockNumber) } : {}),
		}
	}

	async getCheckpoint(): Promise<SyncCheckpoint | undefined> {
		const database = await this.#database()
		const checkpoint = await database.get("meta", CHECKPOINT_META_KEY)
		if (!checkpoint) {
			return undefined
		}
		return {
			blockNumber: BigInt(checkpoint.blockNumber),
			...(checkpoint.blockHash === undefined ? {} : { blockHash: checkpoint.blockHash }),
		}
	}

	async clearCurrentNamespace(): Promise<void> {
		if (this.#databasePromise) {
			const database = await this.#databasePromise
			database.close()
			this.#databasePromise = undefined
		}
		await deleteDB(this.namespace)
	}
}

export function createStorageRepository(options: CreateStorageRepositoryOptions): StorageRepository {
	return new IndexedDbStorageRepository(options)
}

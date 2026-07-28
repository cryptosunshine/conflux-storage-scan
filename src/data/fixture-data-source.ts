import { type Address, getAddress, type Hex, isAddress, isHex, size } from "viem"
import { STORAGE_FEE_CFX, STORAGE_SECTOR_BYTES } from "../chain/config"
import type { SyncState } from "../chain/sync/sync-submissions"
import type { StorageSubmission } from "../chain/types"
import type { Page } from "./indexed-db/storage-db"
import {
	type AddressListSubmissionsQuery,
	type ListSubmissionsQuery,
	normalizeSubmitterAddress,
	type StorageDataSource,
	type StorageSummary,
} from "./storage-data-source"

const DEFAULT_PAGE_SIZE = 20
const MAXIMUM_PAGE_SIZE = 100

export interface CreateFixtureDataSourceOptions {
	readonly submissions: readonly StorageSubmission[]
	readonly contractSubmissionCount: bigint
	readonly allocatedSectorCount: bigint
	readonly headBlock?: bigint
}

export interface CreateFixtureDataSourceFromJsonOptions extends Omit<CreateFixtureDataSourceOptions, "submissions"> {
	readonly submissions: unknown
}

function objectRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${label} must be an object`)
	}
	return value as Readonly<Record<string, unknown>>
}

function stringField(record: Readonly<Record<string, unknown>>, name: string): string {
	const value = record[name]
	if (typeof value !== "string") {
		throw new TypeError(`${name} must be a string`)
	}
	return value
}

function decimalField(record: Readonly<Record<string, unknown>>, name: string): bigint {
	const value = stringField(record, name)
	if (!/^(?:0|[1-9]\d*)$/.test(value)) {
		throw new TypeError(`${name} must be an unsigned decimal string`)
	}
	return BigInt(value)
}

function integerField(record: Readonly<Record<string, unknown>>, name: string): number {
	const value = record[name]
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new TypeError(`${name} must be a non-negative safe integer`)
	}
	return value as number
}

function addressField(record: Readonly<Record<string, unknown>>, name: string): Address {
	const value = stringField(record, name)
	if (!isAddress(value)) {
		throw new TypeError(`${name} must be an EVM address`)
	}
	return getAddress(value)
}

function hexField(record: Readonly<Record<string, unknown>>, name: string, bytes?: number): Hex {
	const value = stringField(record, name)
	if (!isHex(value, { strict: true }) || (bytes !== undefined && size(value) !== bytes)) {
		throw new TypeError(`${name} must be valid hexadecimal bytes`)
	}
	return value
}

function deserializeSubmission(value: unknown): StorageSubmission {
	const record = objectRecord(value, "submission")
	if (record.chainId !== 71) {
		throw new TypeError("chainId must be 71")
	}
	const roots = record.nodeRoots
	if (!Array.isArray(roots)) {
		throw new TypeError("nodeRoots must be an array")
	}
	const transactionLogIndex =
		record.transactionLogIndex === undefined ? undefined : integerField(record, "transactionLogIndex")
	return {
		canonicalKey: stringField(record, "canonicalKey"),
		chainId: 71,
		contractAddress: addressField(record, "contractAddress"),
		implementationAddress: addressField(record, "implementationAddress"),
		sequence: decimalField(record, "sequence"),
		submitter: addressField(record, "submitter"),
		submissionIdentity: hexField(record, "submissionIdentity", 32),
		logicalSizeBytes: decimalField(record, "logicalSizeBytes"),
		startSector: decimalField(record, "startSector"),
		sectorCount: decimalField(record, "sectorCount"),
		endSectorExclusive: decimalField(record, "endSectorExclusive"),
		nodeRoots: roots.map((root) => hexField({ root }, "root", 32)),
		tags: hexField(record, "tags"),
		blockNumber: decimalField(record, "blockNumber"),
		blockHash: hexField(record, "blockHash", 32),
		transactionHash: hexField(record, "transactionHash", 32),
		transactionIndex: integerField(record, "transactionIndex"),
		logIndex: integerField(record, "logIndex"),
		...(transactionLogIndex === undefined ? {} : { transactionLogIndex }),
		timestamp: integerField(record, "timestamp"),
	}
}

function pageQuery(query: ListSubmissionsQuery = {}): {
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
		throw new RangeError("Invalid fixture data source pagination")
	}
	return { page, pageSize }
}

function paginate(
	submissions: readonly StorageSubmission[],
	query: ListSubmissionsQuery = {},
): Page<StorageSubmission> {
	const { page, pageSize } = pageQuery(query)
	const sorted = [...submissions].sort((left, right) =>
		left.sequence === right.sequence ? 0 : left.sequence > right.sequence ? -1 : 1,
	)
	const totalItems = sorted.length
	const start = (page - 1) * pageSize
	return {
		items: sorted.slice(start, start + pageSize),
		page,
		pageSize,
		totalItems,
		totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
	}
}

class FixtureStorageDataSource implements StorageDataSource {
	readonly #fixture: readonly StorageSubmission[]
	readonly #options: CreateFixtureDataSourceOptions
	#submissions: readonly StorageSubmission[]
	#state: SyncState = { status: "idle" }

	constructor(options: CreateFixtureDataSourceOptions) {
		this.#fixture = [...options.submissions]
		this.#submissions = [...options.submissions]
		this.#options = options
	}

	async sync(signal?: AbortSignal): Promise<SyncState> {
		if (signal?.aborted) {
			throw new DOMException("The operation was aborted", "AbortError")
		}
		this.#submissions = [...this.#fixture]
		const syncedAt = Date.now()
		this.#state = {
			status: "fresh",
			headBlock: this.#options.headBlock ?? 0n,
			syncedAt,
		}
		return this.#state
	}

	getSyncState(): SyncState {
		return this.#state
	}

	async getSummary(): Promise<StorageSummary> {
		return {
			contractSubmissionCount: this.#options.contractSubmissionCount,
			indexedSubmissionCount: BigInt(this.#submissions.length),
			indexedLogicalBytes: this.#submissions.reduce((total, submission) => total + submission.logicalSizeBytes, 0n),
			allocatedSectorCount: this.#options.allocatedSectorCount,
			allocatedBytes: this.#options.allocatedSectorCount * STORAGE_SECTOR_BYTES,
			storageFeeCfx: STORAGE_FEE_CFX,
			...(this.#submissions.length > 0 && this.#options.headBlock !== undefined
				? { latestBlock: this.#options.headBlock }
				: {}),
		}
	}

	async listSubmissions(query: ListSubmissionsQuery = {}): Promise<Page<StorageSubmission>> {
		return paginate(this.#submissions, query)
	}

	async getSubmission(sequence: bigint): Promise<StorageSubmission | undefined> {
		return this.#submissions.find((submission) => submission.sequence === sequence)
	}

	async listBySubmitter(query: AddressListSubmissionsQuery): Promise<Page<StorageSubmission>> {
		const submitter = normalizeSubmitterAddress(query.submitter)
		return paginate(
			this.#submissions.filter((submission) => submission.submitter.toLowerCase() === submitter.toLowerCase()),
			query,
		)
	}

	async rebuildLocalIndex(): Promise<void> {
		this.#submissions = []
		this.#state = { status: "idle" }
	}
}

export function createFixtureDataSource(options: CreateFixtureDataSourceOptions): StorageDataSource {
	return new FixtureStorageDataSource(options)
}

export function createFixtureDataSourceFromJson(options: CreateFixtureDataSourceFromJsonOptions): StorageDataSource {
	if (!Array.isArray(options.submissions)) {
		throw new TypeError("Fixture submissions must be an array")
	}
	return createFixtureDataSource({
		...options,
		submissions: options.submissions.map(deserializeSubmission),
	})
}

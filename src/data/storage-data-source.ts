import { type Address, getAddress, isAddress } from "viem"
import type { StorageAnalyticsTimeline } from "../analytics/types"
import type { SyncState } from "../chain/sync/sync-submissions"
import type { StorageSubmission } from "../chain/types"
import type { Page } from "./indexed-db/storage-db"

export interface ListSubmissionsQuery {
	readonly page?: number
	readonly pageSize?: number
}

export interface AddressListSubmissionsQuery extends ListSubmissionsQuery {
	readonly submitter: string
}

export interface StorageSummary {
	readonly contractSubmissionCount: bigint
	readonly indexedSubmissionCount: bigint
	readonly indexedLogicalBytes: bigint
	readonly allocatedSectorCount: bigint
	readonly allocatedBytes: bigint
	readonly storageFeeCfx: 0n
	readonly latestBlock?: bigint
}

export interface SubmitterSummary {
	readonly indexedSubmissionCount: bigint
	readonly indexedLogicalBytes: bigint
}

export interface StorageDataSource {
	sync(signal?: AbortSignal): Promise<SyncState>
	getSyncState(): SyncState
	getAnalyticsTimeline(asOfTimestamp?: number): Promise<StorageAnalyticsTimeline>
	getSummary(): Promise<StorageSummary>
	getSubmitterSummary(submitter: string): Promise<SubmitterSummary>
	listSubmissions(query?: ListSubmissionsQuery): Promise<Page<StorageSubmission>>
	getSubmission(sequence: bigint): Promise<StorageSubmission | undefined>
	listBySubmitter(query: AddressListSubmissionsQuery): Promise<Page<StorageSubmission>>
	rebuildLocalIndex(): Promise<void>
}

export function normalizeSubmitterAddress(value: string): Address {
	const normalizedPrefix = value.startsWith("0X") ? `0x${value.slice(2)}` : value
	if (!isAddress(normalizedPrefix)) {
		throw new TypeError(`Invalid submitter address: ${value}`)
	}
	return getAddress(normalizedPrefix)
}

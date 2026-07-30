import { STORAGE_SEGMENT_BYTES, STORAGE_UPLOAD_CONCURRENCY, STORAGE_UPLOAD_MAX_ATTEMPTS } from "../config"
import type { StorageNodeClient } from "../node/storage-node-client"
import { createStorageSegment, type PreparedStorageFile } from "../sdk/prepare-file"
import { StoragePocError, type StorageSegmentWithProof } from "../types"

export interface StorageUploadProgress {
	readonly confirmedBytes: number
	readonly confirmedSegments: number
	readonly totalBytes: number
	readonly totalSegments: number
}

export interface UploadPreparedSegmentsInput {
	readonly client: StorageNodeClient
	readonly concurrency?: number
	readonly createSegment?: (prepared: PreparedStorageFile, segmentIndex: number) => Promise<StorageSegmentWithProof>
	readonly maxAttempts?: number
	readonly onProgress?: (progress: StorageUploadProgress) => void
	readonly prepared: PreparedStorageFile
	readonly sleep?: (milliseconds: number) => Promise<void>
	readonly txSeq: number
}

const sleepFor = (milliseconds: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, milliseconds)
	})

function isAlreadyUploaded(error: unknown): boolean {
	return error instanceof Error && /already (?:been )?uploaded|uploaded and finalized/i.test(error.message)
}

function isRetryable(error: unknown): boolean {
	return (
		error instanceof Error &&
		/too many data writing|rate.?limit|temporar(?:y|ily)|timeout|unavailable/i.test(error.message)
	)
}

async function uploadSegmentWithRetry(input: {
	readonly client: StorageNodeClient
	readonly maxAttempts: number
	readonly segment: StorageSegmentWithProof
	readonly sleep: (milliseconds: number) => Promise<void>
	readonly txSeq: number
}): Promise<void> {
	for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
		try {
			await input.client.uploadSegmentsByTxSeq([input.segment], input.txSeq)
			return
		} catch (cause) {
			if (isAlreadyUploaded(cause)) {
				return
			}
			if (!isRetryable(cause) || attempt === input.maxAttempts) {
				throw new StoragePocError("UPLOAD_FAILED", `Storage Node rejected Segment ${input.segment.index}`, { cause })
			}
			await input.sleep(500 * 2 ** (attempt - 1))
		}
	}
}

function confirmedLogicalBytes(confirmed: ReadonlySet<number>, fileSize: number): number {
	let total = 0
	for (const segmentIndex of confirmed) {
		const offset = segmentIndex * STORAGE_SEGMENT_BYTES
		total += Math.max(0, Math.min(STORAGE_SEGMENT_BYTES, fileSize - offset))
	}
	return total
}

export async function uploadPreparedSegments({
	client,
	concurrency = STORAGE_UPLOAD_CONCURRENCY,
	createSegment = createStorageSegment,
	maxAttempts = STORAGE_UPLOAD_MAX_ATTEMPTS,
	onProgress,
	prepared,
	sleep = sleepFor,
	txSeq,
}: UploadPreparedSegmentsInput): Promise<void> {
	if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
		throw new StoragePocError("INVALID_ARGUMENT", "Upload concurrency must be a positive safe integer")
	}
	if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
		throw new StoragePocError("INVALID_ARGUMENT", "Upload attempts must be a positive safe integer")
	}

	let nextSegmentIndex = 0
	let fatalError: unknown
	const confirmed = new Set<number>()

	const reportProgress = () => {
		onProgress?.({
			confirmedBytes: confirmedLogicalBytes(confirmed, prepared.source.size),
			confirmedSegments: confirmed.size,
			totalBytes: prepared.source.size,
			totalSegments: prepared.segmentCount,
		})
	}

	const worker = async () => {
		while (fatalError === undefined) {
			const segmentIndex = nextSegmentIndex
			nextSegmentIndex += 1
			if (segmentIndex >= prepared.segmentCount) {
				return
			}
			try {
				const segment = await createSegment(prepared, segmentIndex)
				await uploadSegmentWithRetry({
					client,
					maxAttempts,
					segment,
					sleep,
					txSeq,
				})
				confirmed.add(segmentIndex)
				reportProgress()
			} catch (error) {
				fatalError = error
				throw error
			}
		}
	}

	const workerCount = Math.min(concurrency, prepared.segmentCount)
	await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

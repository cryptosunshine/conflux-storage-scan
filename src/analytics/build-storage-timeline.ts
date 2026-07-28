import { STORAGE_SECTOR_BYTES } from "../chain/config"
import type { StorageSubmission } from "../chain/types"
import type { AnalyticsRange, StorageAnalyticsTimeline, StorageTimelinePoint } from "./types"

const DAY_MILLISECONDS = 86_400_000

interface DailyIncrement {
	logicalBytes: bigint
	maximumEndSector: bigint
	submissionCount: bigint
}

function utcDateFromSeconds(timestamp: number): string {
	if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
		throw new RangeError("Timeline timestamp must be a non-negative safe integer")
	}
	const date = new Date(timestamp * 1_000)
	if (Number.isNaN(date.getTime())) {
		throw new RangeError("Timeline timestamp must be a valid UTC instant")
	}
	return date.toISOString().slice(0, 10)
}

function utcDateMilliseconds(date: string): number {
	return Date.parse(`${date}T00:00:00.000Z`)
}

function eachUtcDate(firstDate: string, lastDate: string): readonly string[] {
	const first = utcDateMilliseconds(firstDate)
	const last = utcDateMilliseconds(lastDate)
	if (first > last) {
		throw new RangeError("Timeline as-of date cannot precede the first submission")
	}
	const dates: string[] = []
	for (let current = first; current <= last; current += DAY_MILLISECONDS) {
		dates.push(new Date(current).toISOString().slice(0, 10))
	}
	return dates
}

export function buildStorageTimeline(
	submissions: readonly StorageSubmission[],
	asOfTimestamp = Math.floor(Date.now() / 1_000),
): StorageAnalyticsTimeline {
	const asOfDate = utcDateFromSeconds(asOfTimestamp)
	if (submissions.length === 0) {
		return { asOfDate, points: [] }
	}

	const increments = new Map<string, DailyIncrement>()
	for (const submission of submissions) {
		const date = utcDateFromSeconds(submission.timestamp)
		const current = increments.get(date) ?? {
			logicalBytes: 0n,
			maximumEndSector: 0n,
			submissionCount: 0n,
		}
		increments.set(date, {
			logicalBytes: current.logicalBytes + submission.logicalSizeBytes,
			maximumEndSector:
				submission.endSectorExclusive > current.maximumEndSector
					? submission.endSectorExclusive
					: current.maximumEndSector,
			submissionCount: current.submissionCount + 1n,
		})
	}

	const firstSubmissionDate = [...increments.keys()].sort()[0]
	if (!firstSubmissionDate) {
		return { asOfDate, points: [] }
	}

	let allocatedSectorCount = 0n
	let cumulativeLogicalBytes = 0n
	let cumulativeSubmissionCount = 0n
	const points: StorageTimelinePoint[] = eachUtcDate(firstSubmissionDate, asOfDate).map((date) => {
		const increment = increments.get(date) ?? {
			logicalBytes: 0n,
			maximumEndSector: 0n,
			submissionCount: 0n,
		}
		cumulativeLogicalBytes += increment.logicalBytes
		cumulativeSubmissionCount += increment.submissionCount
		if (increment.maximumEndSector > allocatedSectorCount) {
			allocatedSectorCount = increment.maximumEndSector
		}
		return {
			allocatedBytes: allocatedSectorCount * STORAGE_SECTOR_BYTES,
			allocatedSectorCount,
			cumulativeLogicalBytes,
			cumulativeSubmissionCount,
			dailyLogicalBytes: increment.logicalBytes,
			dailySubmissionCount: increment.submissionCount,
			date,
		}
	})

	return {
		asOfDate,
		firstSubmissionDate,
		points,
	}
}

export function selectTimelineRange(
	timeline: StorageAnalyticsTimeline,
	range: AnalyticsRange,
): StorageAnalyticsTimeline {
	if (range === "all") {
		return timeline
	}
	const days = range === "7d" ? 7 : 30
	return {
		...timeline,
		points: timeline.points.slice(-days),
	}
}

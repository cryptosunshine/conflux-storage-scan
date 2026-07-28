export type AnalyticsMetric = "storage" | "submissions"
export type AnalyticsRange = "7d" | "30d" | "all"

export interface StorageTimelinePoint {
	readonly date: string
	readonly dailySubmissionCount: bigint
	readonly dailyLogicalBytes: bigint
	readonly cumulativeSubmissionCount: bigint
	readonly cumulativeLogicalBytes: bigint
	readonly allocatedSectorCount: bigint
	readonly allocatedBytes: bigint
}

export interface StorageAnalyticsTimeline {
	readonly points: readonly StorageTimelinePoint[]
	readonly firstSubmissionDate?: string
	readonly asOfDate: string
}

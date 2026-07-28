import { describe, expect, it } from "vitest"
import { createSubmissionFixture } from "../test/fixtures"
import { buildStorageTimeline, selectTimelineRange } from "./build-storage-timeline"

const utcSeconds = (year: number, month: number, day: number, hour = 0) =>
	Math.floor(Date.UTC(year, month - 1, day, hour) / 1_000)

describe("buildStorageTimeline", () => {
	it("sorts submissions into UTC days, fills gaps, and carries cumulative values", () => {
		const result = buildStorageTimeline(
			[
				createSubmissionFixture(2n, {
					endSectorExclusive: 40n,
					logicalSizeBytes: 5n,
					timestamp: utcSeconds(2026, 7, 3, 1),
				}),
				createSubmissionFixture(1n, {
					endSectorExclusive: 12n,
					logicalSizeBytes: 3n,
					timestamp: utcSeconds(2026, 7, 1, 23),
				}),
			],
			utcSeconds(2026, 7, 4, 12),
		)

		expect(result).toMatchObject({
			asOfDate: "2026-07-04",
			firstSubmissionDate: "2026-07-01",
		})
		expect(result.points.map((point) => point.date)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"])
		expect(result.points[0]).toMatchObject({
			allocatedBytes: 3_072n,
			allocatedSectorCount: 12n,
			cumulativeLogicalBytes: 3n,
			cumulativeSubmissionCount: 1n,
			dailyLogicalBytes: 3n,
			dailySubmissionCount: 1n,
		})
		expect(result.points[1]).toMatchObject({
			allocatedBytes: 3_072n,
			cumulativeLogicalBytes: 3n,
			dailyLogicalBytes: 0n,
			dailySubmissionCount: 0n,
		})
		expect(result.points[2]).toMatchObject({
			allocatedBytes: 10_240n,
			allocatedSectorCount: 40n,
			cumulativeLogicalBytes: 8n,
			cumulativeSubmissionCount: 2n,
			dailyLogicalBytes: 5n,
			dailySubmissionCount: 1n,
		})
		expect(result.points[3]).toMatchObject({
			allocatedBytes: 10_240n,
			cumulativeLogicalBytes: 8n,
			dailyLogicalBytes: 0n,
			dailySubmissionCount: 0n,
		})
	})

	it("uses the maximum allocated end sector instead of summing sector counts", () => {
		const result = buildStorageTimeline(
			[
				createSubmissionFixture(0n, {
					endSectorExclusive: 100n,
					sectorCount: 100n,
					timestamp: utcSeconds(2026, 7, 1),
				}),
				createSubmissionFixture(1n, {
					endSectorExclusive: 80n,
					sectorCount: 20n,
					timestamp: utcSeconds(2026, 7, 2),
				}),
			],
			utcSeconds(2026, 7, 2),
		)

		expect(result.points.at(-1)).toMatchObject({
			allocatedBytes: 25_600n,
			allocatedSectorCount: 100n,
		})
	})

	it("returns no fabricated points for an empty index", () => {
		expect(buildStorageTimeline([], utcSeconds(2026, 7, 4))).toEqual({
			asOfDate: "2026-07-04",
			points: [],
		})
	})

	it("selects inclusive 7-day and 30-day windows ending on the as-of date", () => {
		const timeline = buildStorageTimeline(
			[
				createSubmissionFixture(0n, {
					timestamp: utcSeconds(2026, 5, 1),
				}),
			],
			utcSeconds(2026, 7, 4),
		)

		expect(selectTimelineRange(timeline, "7d").points).toHaveLength(7)
		expect(selectTimelineRange(timeline, "7d").points[0]?.date).toBe("2026-06-28")
		expect(selectTimelineRange(timeline, "30d").points).toHaveLength(30)
		expect(selectTimelineRange(timeline, "30d").points[0]?.date).toBe("2026-06-05")
		expect(selectTimelineRange(timeline, "all").points).toBe(timeline.points)
	})
})

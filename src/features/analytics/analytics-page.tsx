import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { selectTimelineRange } from "../../analytics/build-storage-timeline"
import type { AnalyticsMetric, AnalyticsRange } from "../../analytics/types"
import { useStorageDataSource } from "../../app/providers"
import { StorageGrowthChart } from "../../components/charts/storage-growth-chart"
import { SubmissionActivityChart } from "../../components/charts/submission-activity-chart"
import { SyncStatus } from "../../components/sync-status"
import { createStorageQueries } from "../../data/queries"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

export interface AnalyticsPageProps {
	readonly metric: AnalyticsMetric
	readonly range: AnalyticsRange
}

const ranges: readonly { readonly label: string; readonly value: AnalyticsRange }[] = [
	{ label: "7D", value: "7d" },
	{ label: "30D", value: "30d" },
	{ label: "All", value: "all" },
]

export function AnalyticsPage({ metric, range }: AnalyticsPageProps) {
	const dataSource = useStorageDataSource()
	const analytics = useQuery(createStorageQueries(dataSource).analytics())
	const sync = useStorageSync()
	const syncState = sync.data ?? dataSource.getSyncState()
	const storageSection = useRef<HTMLElement>(null)
	const submissionsSection = useRef<HTMLElement>(null)
	const timeline = analytics.data ? selectTimelineRange(analytics.data, range) : undefined
	const timelineReady = Boolean(timeline?.points.length)

	useEffect(() => {
		if (!timelineReady) {
			return
		}
		const target = metric === "storage" ? storageSection.current : submissionsSection.current
		if (!target) {
			return
		}
		target.focus({ preventScroll: true })
		target.scrollIntoView?.({
			behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
			block: "start",
		})
	}, [metric, timelineReady])

	return (
		<section aria-labelledby="analytics-title" className="page-section analytics-page">
			<header className="page-heading analytics-page__heading">
				<div>
					<p className="eyebrow">Indexed Submit events</p>
					<h1 id="analytics-title">Storage analytics</h1>
					<p className="analytics-page__intro">UTC daily trends derived from the canonical local index.</p>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					{analytics.data ? (
						<p>
							As of <time dateTime={`${analytics.data.asOfDate}T00:00:00.000Z`}>{analytics.data.asOfDate} UTC</time>
						</p>
					) : null}
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			<nav aria-label="Analytics time range" className="analytics-range-control">
				{ranges.map((candidate) => (
					<Link
						aria-current={range === candidate.value ? "page" : undefined}
						key={candidate.value}
						search={{ metric, range: candidate.value }}
						to="/analytics"
					>
						{candidate.label}
					</Link>
				))}
			</nav>

			{analytics.isPending || !timeline ? (
				<div
					aria-label="Loading storage analytics…"
					className="analytics-detail-grid analytics-detail-grid--loading"
					role="status"
				>
					<div className="skeleton" />
					<div className="skeleton" />
				</div>
			) : timeline.points.length === 0 ? (
				<section className="content-panel empty-state">
					<h2>No indexed submission history is available yet</h2>
					<p>Storage analytics will appear after canonical Submit events are indexed.</p>
				</section>
			) : (
				<div className="analytics-detail-grid">
					<section
						aria-label="Indexed storage growth"
						className={
							metric === "storage" ? "analytics-chart-panel analytics-chart-panel--active" : "analytics-chart-panel"
						}
						ref={storageSection}
						tabIndex={-1}
					>
						<StorageGrowthChart points={timeline.points} />
					</section>
					<section
						aria-label="Daily submission activity"
						className={
							metric === "submissions" ? "analytics-chart-panel analytics-chart-panel--active" : "analytics-chart-panel"
						}
						ref={submissionsSection}
						tabIndex={-1}
					>
						<SubmissionActivityChart points={timeline.points} />
					</section>
				</div>
			)}
		</section>
	)
}

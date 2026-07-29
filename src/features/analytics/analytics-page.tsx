import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { selectTimelineRange } from "../../analytics/build-storage-timeline"
import type { AnalyticsMetric, AnalyticsRange } from "../../analytics/types"
import { useStorageDataSource } from "../../app/providers"
import { formatUtcDate } from "../../components/charts/chart-format"
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

const ranges: readonly AnalyticsRange[] = ["7d", "30d", "all"]

export function AnalyticsPage({ metric, range }: AnalyticsPageProps) {
	const { i18n, t } = useTranslation("analytics")
	const locale = i18n.resolvedLanguage ?? i18n.language
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
					<p className="eyebrow">{t("page.eyebrow")}</p>
					<h1 id="analytics-title">{t("page.title")}</h1>
					<p className="analytics-page__intro">{t("page.intro")}</p>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					{analytics.data ? (
						<p>
							<time dateTime={`${analytics.data.asOfDate}T00:00:00.000Z`}>
								{t("page.asOf", {
									date: formatUtcDate(analytics.data.asOfDate, locale),
								})}
							</time>
						</p>
					) : null}
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			<nav aria-label={t("page.rangeAria")} className="analytics-range-control">
				{ranges.map((candidate) => (
					<Link
						aria-current={range === candidate ? "page" : undefined}
						key={candidate}
						search={{ metric, range: candidate }}
						to="/analytics"
					>
						{candidate === "7d" ? t("page.range7") : candidate === "30d" ? t("page.range30") : t("page.rangeAll")}
					</Link>
				))}
			</nav>

			{analytics.isPending || !timeline ? (
				<div
					aria-label={t("page.loading")}
					className="analytics-detail-grid analytics-detail-grid--loading"
					role="status"
				>
					<div className="skeleton" />
					<div className="skeleton" />
				</div>
			) : timeline.points.length === 0 ? (
				<section className="content-panel empty-state">
					<h2>{t("page.emptyTitle")}</h2>
					<p>{t("page.emptyDescription")}</p>
				</section>
			) : (
				<div className="analytics-detail-grid">
					<section
						aria-label={t("storage.title")}
						className={
							metric === "storage" ? "analytics-chart-panel analytics-chart-panel--active" : "analytics-chart-panel"
						}
						ref={storageSection}
						tabIndex={-1}
					>
						<StorageGrowthChart points={timeline.points} />
					</section>
					<section
						aria-label={t("activity.title")}
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

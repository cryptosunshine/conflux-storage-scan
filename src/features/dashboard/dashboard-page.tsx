import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useStorageDataSource } from "../../app/providers"
import { formatBytes, formatInteger } from "../../components/format"
import { MetricCard } from "../../components/metric-card"
import { SubmissionTable } from "../../components/submission-table"
import { SyncStatus } from "../../components/sync-status"
import { createStorageQueries } from "../../data/queries"
import { AnalyticsPreviewCards } from "../analytics/analytics-preview-cards"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

export function DashboardPage() {
	const { i18n, t } = useTranslation(["common", "explorer", "errors"])
	const locale = i18n.resolvedLanguage ?? i18n.language
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
	const analytics = useQuery(queries.analytics())
	const summary = useQuery(queries.summary())
	const recent = useQuery(queries.submissions(1, 5))
	const sync = useStorageSync()
	const syncState = sync.data ?? dataSource.getSyncState()
	const countMismatch =
		summary.data !== undefined && summary.data.contractSubmissionCount !== summary.data.indexedSubmissionCount

	return (
		<section aria-labelledby="overview-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">{t("dashboard.eyebrow", { ns: "explorer" })}</p>
					<h1 id="overview-title">{t("dashboard.title", { ns: "explorer" })}</h1>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					<p>{t("dashboard.description", { ns: "explorer" })}</p>
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />
			{countMismatch && summary.data ? (
				<RecoveryDataState
					onRetry={() => void sync.refetch()}
					state={{
						error: {
							code: "INDEX_COUNT_MISMATCH",
							message: t("codes.INDEX_COUNT_MISMATCH", {
								contract: formatInteger(summary.data.contractSubmissionCount, locale),
								indexed: formatInteger(summary.data.indexedSubmissionCount, locale),
								ns: "errors",
							}),
						},
						gaps: [],
						status: "partial",
					}}
				/>
			) : null}

			{summary.data ? (
				<div className="metrics-grid">
					<MetricCard
						detail={t("dashboard.contractDetail", { ns: "explorer" })}
						label={t("dashboard.contractSubmissions", { ns: "explorer" })}
						value={formatInteger(summary.data.contractSubmissionCount, locale)}
					/>
					<MetricCard
						detail={t("dashboard.indexedDetail", { ns: "explorer" })}
						label={t("dashboard.indexedSubmissions", { ns: "explorer" })}
						value={formatInteger(summary.data.indexedSubmissionCount, locale)}
					/>
					<MetricCard
						detail={t("dashboard.indexedLogicalDetail", { ns: "explorer" })}
						label={t("dashboard.indexedLogicalData", { ns: "explorer" })}
						value={formatBytes(summary.data.indexedLogicalBytes, locale)}
					/>
					<MetricCard
						detail={t("dashboard.allocatedDetail", {
							ns: "explorer",
							sectors: formatInteger(summary.data.allocatedSectorCount, locale),
						})}
						label={t("dashboard.allocatedStorage", { ns: "explorer" })}
						value={formatBytes(summary.data.allocatedBytes, locale)}
					/>
					<MetricCard
						detail={t("dashboard.storageFeeDetail", { ns: "explorer" })}
						label={t("dashboard.storageFee", { ns: "explorer" })}
						value="0 CFX"
					/>
				</div>
			) : (
				<div
					aria-label={t("dashboard.loadingMetrics", { ns: "explorer" })}
					className="metrics-grid metrics-grid--loading"
					role="status"
				>
					{["metric-a", "metric-b", "metric-c", "metric-d", "metric-e"].map((metric) => (
						<div className="skeleton" key={metric} />
					))}
				</div>
			)}

			<AnalyticsPreviewCards loading={analytics.isPending} timeline={analytics.data} />

			<section aria-labelledby="recent-title" className="content-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">{t("dashboard.latestActivity", { ns: "explorer" })}</p>
						<h2 id="recent-title">{t("dashboard.recentSubmissions", { ns: "explorer" })}</h2>
					</div>
					<Link className="text-link" search={{ page: 1 }} to="/submissions">
						{t("actions.viewAll")}
						<ArrowRight aria-hidden="true" size={15} />
					</Link>
				</header>
				{recent.data ? (
					<SubmissionTable
						caption={t("dashboard.recentCaption", { ns: "explorer" })}
						compact
						submissions={recent.data.items}
					/>
				) : (
					<div
						aria-label={t("dashboard.loadingRecent", { ns: "explorer" })}
						className="table-loading skeleton"
						role="status"
					/>
				)}
			</section>
		</section>
	)
}

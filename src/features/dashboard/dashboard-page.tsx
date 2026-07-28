import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useStorageDataSource } from "../../app/providers"
import { formatBytes, formatInteger } from "../../components/format"
import { MetricCard } from "../../components/metric-card"
import { SubmissionTable } from "../../components/submission-table"
import { SyncStatus } from "../../components/sync-status"
import { createStorageQueries } from "../../data/queries"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

export function DashboardPage() {
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
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
					<p className="eyebrow">FixedPriceFlow</p>
					<h1 id="overview-title">Storage overview</h1>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					<p>Canonical submissions indexed from Conflux eSpace Testnet.</p>
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />
			{countMismatch && summary.data ? (
				<RecoveryDataState
					onRetry={() => void sync.refetch()}
					state={{
						error: {
							code: "INDEX_COUNT_MISMATCH",
							message: `${summary.data.indexedSubmissionCount.toString()} of ${summary.data.contractSubmissionCount.toString()} contract submissions are indexed.`,
						},
						gaps: [],
						status: "partial",
					}}
				/>
			) : null}

			{summary.data ? (
				<div className="metrics-grid">
					<MetricCard
						detail="FixedPriceFlow submissionIndex"
						label="Contract submissions"
						value={formatInteger(summary.data.contractSubmissionCount)}
					/>
					<MetricCard
						detail="Validated Submit events"
						label="Indexed submissions"
						value={formatInteger(summary.data.indexedSubmissionCount)}
					/>
					<MetricCard
						detail="Sum of submission.data.length"
						label="Indexed logical data"
						value={formatBytes(summary.data.indexedLogicalBytes)}
					/>
					<MetricCard
						detail={`${formatInteger(summary.data.allocatedSectorCount)} × 256-byte sectors`}
						label="Allocated storage"
						value={formatBytes(summary.data.allocatedBytes)}
					/>
					<MetricCard detail="Testnet product constant" label="Storage fee" value="0 CFX" />
				</div>
			) : (
				<div aria-label="Loading storage metrics" className="metrics-grid metrics-grid--loading" role="status">
					{["metric-a", "metric-b", "metric-c", "metric-d", "metric-e"].map((metric) => (
						<div className="skeleton" key={metric} />
					))}
				</div>
			)}

			<section aria-labelledby="recent-title" className="content-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">Latest activity</p>
						<h2 id="recent-title">Recent submissions</h2>
					</div>
					<Link className="text-link" search={{ page: 1 }} to="/submissions">
						View all
						<ArrowRight aria-hidden="true" size={15} />
					</Link>
				</header>
				{recent.data ? (
					<SubmissionTable caption="Recent submissions" compact submissions={recent.data.items} />
				) : (
					<div aria-label="Loading recent submissions" className="table-loading skeleton" role="status" />
				)}
			</section>
		</section>
	)
}

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useStorageDataSource } from "../../app/providers"
import { Pagination } from "../../components/pagination"
import { SubmissionTable } from "../../components/submission-table"
import { SyncStatus } from "../../components/sync-status"
import { createStorageQueries } from "../../data/queries"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

export interface SubmissionsPageProps {
	readonly page: number
}

export function SubmissionsPage({ page }: SubmissionsPageProps) {
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
	const submissions = useQuery({
		...queries.submissions(page, 20),
		placeholderData: keepPreviousData,
	})
	const sync = useStorageSync()
	const syncState = sync.data ?? dataSource.getSyncState()

	return (
		<section aria-labelledby="submissions-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">All activity</p>
					<h1 id="submissions-title">Storage submissions</h1>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					<p>One row per canonical FixedPriceFlow Submit event.</p>
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			<section aria-labelledby="submission-list-title" className="content-panel">
				<header className="section-heading">
					<div>
						<h2 id="submission-list-title">Indexed activity</h2>
						{submissions.data ? <p>{submissions.data.totalItems.toLocaleString()} submissions</p> : null}
					</div>
					{submissions.isFetching && !submissions.isPending ? (
						<span aria-live="polite" className="refresh-label">
							Refreshing…
						</span>
					) : null}
				</header>

				{submissions.data ? (
					submissions.data.items.length > 0 ? (
						<>
							<SubmissionTable caption="Storage submissions" submissions={submissions.data.items} />
							<Pagination
								buildHref={(targetPage) => `/submissions?page=${targetPage}`}
								page={submissions.data.page}
								totalPages={submissions.data.totalPages}
							/>
						</>
					) : (
						<div className="empty-state">
							<h3>No submissions indexed</h3>
							<p>The local index does not contain a canonical Submit event yet.</p>
						</div>
					)
				) : (
					<div aria-label="Loading storage submissions" className="table-loading skeleton" role="status" />
				)}
			</section>
		</section>
	)
}

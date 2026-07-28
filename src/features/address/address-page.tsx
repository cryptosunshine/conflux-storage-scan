import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { useStorageDataSource } from "../../app/providers"
import { CopyButton } from "../../components/copy-button"
import { DataState } from "../../components/data-state"
import { formatBytes, formatInteger } from "../../components/format"
import { MetricCard } from "../../components/metric-card"
import { Pagination } from "../../components/pagination"
import { SubmissionTable } from "../../components/submission-table"
import { SyncStatus } from "../../components/sync-status"
import { createStorageQueries } from "../../data/queries"
import { useStorageSync } from "../storage/use-storage-sync"

export interface AddressPageProps {
	readonly address: Address
	readonly page: number
}

export function AddressPage({ address, page }: AddressPageProps) {
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
	const summary = useQuery(queries.addressSummary(address))
	const submissions = useQuery({
		...queries.address(address, page),
		placeholderData: keepPreviousData,
	})
	const sync = useStorageSync()
	const syncState = sync.data ?? dataSource.getSyncState()

	return (
		<section aria-labelledby="address-title" className="page-section">
			<header className="page-heading page-heading--address">
				<div>
					<p className="eyebrow">Event submitter</p>
					<h1 id="address-title">Address activity</h1>
					<div className="full-address">
						<code>{address}</code>
						<CopyButton label="Copy full submitter address" value={address} />
					</div>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					<p>Filtered by the submitter recorded in FixedPriceFlow Submit events.</p>
				</div>
			</header>

			<DataState onRetry={() => void sync.refetch()} state={syncState} />

			{summary.data ? (
				<div className="address-metrics">
					<MetricCard label="Indexed submissions" value={formatInteger(summary.data.indexedSubmissionCount)} />
					<MetricCard label="Indexed logical data" value={formatBytes(summary.data.indexedLogicalBytes)} />
				</div>
			) : (
				<div aria-label="Loading address summary" className="address-metrics" role="status">
					<div className="address-metrics__skeleton skeleton" />
					<div className="address-metrics__skeleton skeleton" />
				</div>
			)}

			<section aria-labelledby="address-submissions-title" className="content-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">Canonical activity</p>
						<h2 id="address-submissions-title">Submitted storage</h2>
					</div>
					{submissions.data ? <p>{submissions.data.totalItems} events</p> : null}
				</header>

				{submissions.data ? (
					submissions.data.items.length > 0 ? (
						<>
							<SubmissionTable caption={`Submissions by ${address}`} submissions={submissions.data.items} />
							<Pagination
								buildHref={(targetPage) => `/address/${address}?page=${targetPage}`}
								page={submissions.data.page}
								totalPages={submissions.data.totalPages}
							/>
						</>
					) : (
						<div className="empty-state">
							<h3>No submissions from this address</h3>
							<p>No indexed Submit event names this address as its submitter.</p>
						</div>
					)
				) : (
					<div aria-label="Loading address submissions" className="table-loading skeleton" role="status" />
				)}
			</section>
		</section>
	)
}

import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { Address } from "viem"
import { useStorageDataSource } from "../../app/providers"
import { CopyButton } from "../../components/copy-button"
import { formatBytes, formatInteger } from "../../components/format"
import { MetricCard } from "../../components/metric-card"
import { Pagination } from "../../components/pagination"
import { SubmissionTable } from "../../components/submission-table"
import { SyncStatus } from "../../components/sync-status"
import { createStorageQueries, keepPreviousAddressPage } from "../../data/queries"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

export interface AddressPageProps {
	readonly address: Address
	readonly page: number
}

export function AddressPage({ address, page }: AddressPageProps) {
	const { i18n, t } = useTranslation("explorer")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
	const summary = useQuery(queries.addressSummary(address))
	const submissions = useQuery({
		...queries.address(address, page),
		placeholderData: (previousData, previousQuery) => keepPreviousAddressPage(address, previousData, previousQuery),
	})
	const sync = useStorageSync([address])
	const syncState = sync.data ?? dataSource.getSyncState()

	return (
		<section aria-labelledby="address-title" className="page-section">
			<header className="page-heading page-heading--address">
				<div>
					<p className="eyebrow">{t("address.eyebrow")}</p>
					<h1 id="address-title">{t("address.title")}</h1>
					<div className="full-address">
						<code>{address}</code>
						<CopyButton label={t("address.copyAddress")} value={address} />
					</div>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					<p>{t("address.description")}</p>
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			{summary.data ? (
				<div className="address-metrics">
					<MetricCard
						label={t("dashboard.indexedSubmissions")}
						value={formatInteger(summary.data.indexedSubmissionCount, locale)}
					/>
					<MetricCard
						label={t("dashboard.indexedLogicalData")}
						value={formatBytes(summary.data.indexedLogicalBytes, locale)}
					/>
				</div>
			) : (
				<div aria-label={t("address.loadingSummary")} className="address-metrics" role="status">
					<div className="address-metrics__skeleton skeleton" />
					<div className="address-metrics__skeleton skeleton" />
				</div>
			)}

			<section aria-labelledby="address-submissions-title" className="content-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">{t("address.canonicalActivity")}</p>
						<h2 id="address-submissions-title">{t("address.submittedStorage")}</h2>
					</div>
					{submissions.data ? <p>{t("address.eventCount", { count: submissions.data.totalItems })}</p> : null}
				</header>

				{submissions.data ? (
					submissions.data.items.length > 0 ? (
						<>
							<SubmissionTable caption={t("address.submissionsBy", { address })} submissions={submissions.data.items} />
							<Pagination
								buildHref={(targetPage) => `/address/${address}?page=${targetPage}`}
								page={submissions.data.page}
								totalPages={submissions.data.totalPages}
							/>
						</>
					) : (
						<div className="empty-state">
							<h3>{t("address.emptyTitle")}</h3>
							<p>{t("address.emptyDescription")}</p>
						</div>
					)
				) : (
					<div aria-label={t("address.loadingList")} className="table-loading skeleton" role="status" />
				)}
			</section>
		</section>
	)
}

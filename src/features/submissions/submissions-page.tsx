import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useStorageDataSource } from "../../app/providers"
import { formatInteger } from "../../components/format"
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
	const { i18n, t } = useTranslation("explorer")
	const locale = i18n.resolvedLanguage ?? i18n.language
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
					<p className="eyebrow">{t("submissions.allActivity")}</p>
					<h1 id="submissions-title">{t("submissions.title")}</h1>
				</div>
				<div className="page-heading__status">
					<SyncStatus state={syncState} />
					<p>{t("submissions.description")}</p>
				</div>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			<section aria-labelledby="submission-list-title" className="content-panel">
				<header className="section-heading">
					<div>
						<h2 id="submission-list-title">{t("submissions.indexedActivity")}</h2>
						{submissions.data ? (
							<p>{t("submissions.total", { count: formatInteger(submissions.data.totalItems, locale) })}</p>
						) : null}
					</div>
					{submissions.isFetching && !submissions.isPending ? (
						<span aria-live="polite" className="refresh-label">
							{t("submissions.refreshing")}
						</span>
					) : null}
				</header>

				{submissions.data ? (
					submissions.data.items.length > 0 ? (
						<>
							<SubmissionTable caption={t("submissions.caption")} submissions={submissions.data.items} />
							<Pagination
								buildHref={(targetPage) => `/submissions?page=${targetPage}`}
								page={submissions.data.page}
								totalPages={submissions.data.totalPages}
							/>
						</>
					) : (
						<div className="empty-state">
							<h3>{t("submissions.emptyTitle")}</h3>
							<p>{t("submissions.emptyDescription")}</p>
						</div>
					)
				) : (
					<div aria-label={t("submissions.loading")} className="table-loading skeleton" role="status" />
				)}
			</section>
		</section>
	)
}

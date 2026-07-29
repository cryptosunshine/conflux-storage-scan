import { useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useStorageDataSource } from "../../app/providers"
import { AddressLink } from "../../components/address-link"
import { CopyButton } from "../../components/copy-button"
import { formatBytes, formatInteger, timestampIso, truncateMiddle } from "../../components/format"
import { confluxScanTransactionUrl } from "../../components/submission-table"
import { createStorageQueries } from "../../data/queries"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

function DetailItem({
	label,
	children,
	wide = false,
}: {
	readonly label: string
	readonly children: ReactNode
	readonly wide?: boolean
}) {
	return (
		<div className={wide ? "detail-item detail-item--wide" : "detail-item"}>
			<dt>{label}</dt>
			<dd>{children}</dd>
		</div>
	)
}

function ReadOnlyHash({ label, value }: { readonly label: string; readonly value: string }) {
	return (
		<span className="detail-hash" title={value}>
			<code>{truncateMiddle(value, 12, 10)}</code>
			<CopyButton label={`Copy ${label}`} value={value} />
		</span>
	)
}

export interface SubmissionDetailPageProps {
	readonly sequence: string
}

function queryFailure(error: unknown) {
	const code =
		error && typeof error === "object" && "code" in error && typeof error.code === "string"
			? error.code
			: "SUBMISSION_QUERY_FAILED"
	return {
		error: {
			code,
			message: error instanceof Error ? error.message : "The local submission index could not be read.",
		},
		gaps: [],
		status: "partial" as const,
	}
}

export function SubmissionDetailPage({ sequence }: SubmissionDetailPageProps) {
	const { i18n, t } = useTranslation(["common", "explorer"])
	const locale = i18n.resolvedLanguage ?? i18n.language
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
	const submission = useQuery(queries.submission(sequence))
	const sync = useStorageSync()
	const syncState = sync.data ?? dataSource.getSyncState()

	if (submission.data === undefined && (submission.isPending || submission.isFetching || sync.isPending)) {
		return (
			<div aria-label={t("submission.loading", { ns: "explorer" })} className="detail-loading" role="status">
				<div className="skeleton" />
				<div className="skeleton" />
				<div className="skeleton" />
			</div>
		)
	}

	if (submission.isError) {
		return (
			<section aria-labelledby="submission-unavailable-title" className="page-section">
				<header className="page-heading">
					<div>
						<p className="eyebrow">{t("submission.sequence", { ns: "explorer", sequence })}</p>
						<h1 id="submission-unavailable-title">{t("submission.unavailable", { ns: "explorer" })}</h1>
					</div>
				</header>
				<RecoveryDataState
					onRetry={() => {
						void Promise.all([submission.refetch(), sync.refetch()])
					}}
					state={queryFailure(submission.error)}
				/>
			</section>
		)
	}

	if (!submission.data) {
		return (
			<section className="empty-state empty-state--page">
				<p className="eyebrow">{t("submission.sequence", { ns: "explorer", sequence })}</p>
				<h1>{t("submission.notFoundTitle", { ns: "explorer" })}</h1>
				<p>{t("submission.notFoundDescription", { ns: "explorer" })}</p>
				<a className="secondary-button empty-state__action" href="/submissions?page=1">
					{t("actions.browseSubmissions")}
				</a>
			</section>
		)
	}

	const record = submission.data
	return (
		<section aria-labelledby="submission-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">{t("submission.eyebrow", { ns: "explorer" })}</p>
					<h1 id="submission-title">
						{t("submission.title", {
							ns: "explorer",
							sequence: formatInteger(record.sequence, locale),
						})}
					</h1>
				</div>
				<span className="indexed-status">
					<span aria-hidden="true" />
					{t("submission.indexed", { ns: "explorer" })}
				</span>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			<section aria-labelledby="overview-details-title" className="detail-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">{t("submission.normalizedEvent", { ns: "explorer" })}</p>
						<h2 id="overview-details-title">{t("submission.submissionDetails", { ns: "explorer" })}</h2>
					</div>
				</header>
				<dl className="detail-grid">
					<DetailItem label={t("submission.submitter", { ns: "explorer" })} wide>
						<AddressLink address={record.submitter} />
					</DetailItem>
					<DetailItem label={t("submission.submissionIdentity", { ns: "explorer" })} wide>
						<ReadOnlyHash
							label={t("submission.submissionIdentityCopy", { ns: "explorer" })}
							value={record.submissionIdentity}
						/>
					</DetailItem>
					<DetailItem label={t("submission.logicalSize", { ns: "explorer" })}>
						<strong>{formatBytes(record.logicalSizeBytes, locale)}</strong>
						<small className="detail-item__secondary">
							{t("submission.bytes", {
								count: formatInteger(record.logicalSizeBytes, locale),
								ns: "explorer",
							})}
						</small>
					</DetailItem>
					<DetailItem label={t("submission.storageFee", { ns: "explorer" })}>
						<strong className="zero-fee">0 CFX</strong>
					</DetailItem>
					<DetailItem label={t("submission.startSector", { ns: "explorer" })}>
						{formatInteger(record.startSector, locale)}
					</DetailItem>
					<DetailItem label={t("submission.endSector", { ns: "explorer" })}>
						{formatInteger(record.endSectorExclusive, locale)}
					</DetailItem>
					<DetailItem label={t("submission.sectorCount", { ns: "explorer" })}>
						{formatInteger(record.sectorCount, locale)}
					</DetailItem>
					<DetailItem label={t("submission.nodeCount", { ns: "explorer" })}>
						{formatInteger(record.nodeRoots.length, locale)}
					</DetailItem>
					<DetailItem label={t("submission.tags", { ns: "explorer" })} wide>
						{record.tags === "0x" ? (
							<span className="muted-value">{t("submission.none", { ns: "explorer" })}</span>
						) : (
							<ReadOnlyHash label={t("submission.tagsCopy", { ns: "explorer" })} value={record.tags} />
						)}
					</DetailItem>
				</dl>
			</section>

			<section aria-labelledby="chain-details-title" className="detail-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">{t("submission.provenance", { ns: "explorer" })}</p>
						<h2 id="chain-details-title">{t("submission.chainDetails", { ns: "explorer" })}</h2>
					</div>
				</header>
				<dl className="detail-grid">
					<DetailItem label={t("submission.block", { ns: "explorer" })} wide>
						<strong>#{formatInteger(record.blockNumber, locale)}</strong>
						<ReadOnlyHash label={t("submission.blockHash", { ns: "explorer" })} value={record.blockHash} />
					</DetailItem>
					<DetailItem label={t("submission.transaction", { ns: "explorer" })} wide>
						<span className="detail-hash">
							<a href={confluxScanTransactionUrl(record.transactionHash)} rel="noopener noreferrer" target="_blank">
								{truncateMiddle(record.transactionHash, 12, 10)}
								<ExternalLink aria-hidden="true" size={13} />
							</a>
							<CopyButton label={t("submission.transactionCopy", { ns: "explorer" })} value={record.transactionHash} />
						</span>
					</DetailItem>
					<DetailItem label={t("submission.logIndex", { ns: "explorer" })}>
						{formatInteger(record.logIndex, locale)}
					</DetailItem>
					<DetailItem label={t("submission.timestamp", { ns: "explorer" })}>
						<time dateTime={timestampIso(record.timestamp)}>
							{new Date(record.timestamp * 1_000).toLocaleString(locale)}
						</time>
					</DetailItem>
					<DetailItem label={t("submission.contract", { ns: "explorer" })} wide>
						<ReadOnlyHash label={t("submission.contractAddress", { ns: "explorer" })} value={record.contractAddress} />
					</DetailItem>
					<DetailItem label={t("submission.implementation", { ns: "explorer" })} wide>
						<ReadOnlyHash
							label={t("submission.implementationAddress", { ns: "explorer" })}
							value={record.implementationAddress}
						/>
					</DetailItem>
				</dl>
			</section>
		</section>
	)
}

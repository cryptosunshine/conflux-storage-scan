import { useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
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
	const dataSource = useStorageDataSource()
	const queries = createStorageQueries(dataSource)
	const submission = useQuery(queries.submission(sequence))
	const sync = useStorageSync()
	const syncState = sync.data ?? dataSource.getSyncState()

	if (submission.data === undefined && (submission.isPending || submission.isFetching || sync.isPending)) {
		return (
			<div aria-label="Loading submission details" className="detail-loading" role="status">
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
						<p className="eyebrow">Sequence {sequence}</p>
						<h1 id="submission-unavailable-title">Submission Temporarily Unavailable</h1>
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
				<p className="eyebrow">Sequence {sequence}</p>
				<h1>Submission not found</h1>
				<p>No canonical FixedPriceFlow Submit event is indexed for this sequence.</p>
				<a className="secondary-button empty-state__action" href="/submissions?page=1">
					Browse submissions
				</a>
			</section>
		)
	}

	const record = submission.data
	return (
		<section aria-labelledby="submission-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">FixedPriceFlow submission</p>
					<h1 id="submission-title">Submission #{formatInteger(record.sequence)}</h1>
				</div>
				<span className="indexed-status">
					<span aria-hidden="true" />
					Indexed on eSpace
				</span>
			</header>

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			<section aria-labelledby="overview-details-title" className="detail-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">Normalized event</p>
						<h2 id="overview-details-title">Submission details</h2>
					</div>
				</header>
				<dl className="detail-grid">
					<DetailItem label="Submitter" wide>
						<AddressLink address={record.submitter} />
					</DetailItem>
					<DetailItem label="Submission identity" wide>
						<ReadOnlyHash label="submission identity" value={record.submissionIdentity} />
					</DetailItem>
					<DetailItem label="Logical size">
						<strong>{formatBytes(record.logicalSizeBytes)}</strong>
						<small className="detail-item__secondary">{formatInteger(record.logicalSizeBytes)} bytes</small>
					</DetailItem>
					<DetailItem label="Storage fee">
						<strong className="zero-fee">0 CFX</strong>
					</DetailItem>
					<DetailItem label="Start sector">{formatInteger(record.startSector)}</DetailItem>
					<DetailItem label="End sector (exclusive)">{formatInteger(record.endSectorExclusive)}</DetailItem>
					<DetailItem label="Sector count">{formatInteger(record.sectorCount)}</DetailItem>
					<DetailItem label="Node count">{formatInteger(record.nodeRoots.length)}</DetailItem>
					<DetailItem label="Tags" wide>
						{record.tags === "0x" ? (
							<span className="muted-value">None</span>
						) : (
							<ReadOnlyHash label="tags" value={record.tags} />
						)}
					</DetailItem>
				</dl>
			</section>

			<section aria-labelledby="chain-details-title" className="detail-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">Provenance</p>
						<h2 id="chain-details-title">Chain details</h2>
					</div>
				</header>
				<dl className="detail-grid">
					<DetailItem label="Block" wide>
						<strong>#{formatInteger(record.blockNumber)}</strong>
						<ReadOnlyHash label="block hash" value={record.blockHash} />
					</DetailItem>
					<DetailItem label="Transaction" wide>
						<span className="detail-hash">
							<a href={confluxScanTransactionUrl(record.transactionHash)} rel="noopener noreferrer" target="_blank">
								{truncateMiddle(record.transactionHash, 12, 10)}
								<ExternalLink aria-hidden="true" size={13} />
							</a>
							<CopyButton label="Copy transaction hash" value={record.transactionHash} />
						</span>
					</DetailItem>
					<DetailItem label="Log index">{formatInteger(record.logIndex)}</DetailItem>
					<DetailItem label="Timestamp">
						<time dateTime={timestampIso(record.timestamp)}>{new Date(record.timestamp * 1_000).toLocaleString()}</time>
					</DetailItem>
					<DetailItem label="Contract" wide>
						<ReadOnlyHash label="contract address" value={record.contractAddress} />
					</DetailItem>
					<DetailItem label="Implementation" wide>
						<ReadOnlyHash label="implementation address" value={record.implementationAddress} />
					</DetailItem>
				</dl>
			</section>
		</section>
	)
}

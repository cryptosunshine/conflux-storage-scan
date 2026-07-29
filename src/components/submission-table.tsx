import { Link } from "@tanstack/react-router"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CONFLUX_ESPACE_TESTNET_EXPLORER_URL } from "../chain/config"
import type { StorageSubmission } from "../chain/types"
import { AddressLink } from "./address-link"
import { CopyButton } from "./copy-button"
import { formatBytes, formatInteger, formatRelativeTime, timestampIso, truncateMiddle } from "./format"

export function confluxScanTransactionUrl(hash: `0x${string}`): string {
	return `${CONFLUX_ESPACE_TESTNET_EXPLORER_URL}/tx/${hash}`
}

export interface SubmissionTableProps {
	readonly submissions: readonly StorageSubmission[]
	readonly caption: string
	readonly compact?: boolean
	readonly now?: number
}

export function SubmissionTable({ submissions, caption, compact = false, now }: SubmissionTableProps) {
	const { i18n, t } = useTranslation("common")
	const locale = i18n.resolvedLanguage ?? i18n.language
	return (
		<div className={compact ? "data-table-wrap data-table-wrap--compact" : "data-table-wrap"}>
			<table aria-label={caption} className="data-table">
				<caption className="sr-only">{caption}</caption>
				<thead>
					<tr>
						<th scope="col">{t("table.sequence")}</th>
						<th scope="col">{t("table.submitter")}</th>
						<th className="table-secondary" scope="col">
							{t("table.transaction")}
						</th>
						<th scope="col">{t("table.logicalSize")}</th>
						<th className="table-secondary" scope="col">
							{t("table.sectors")}
						</th>
						<th className="table-secondary" scope="col">
							{t("table.fee")}
						</th>
						<th scope="col">{t("table.age")}</th>
					</tr>
				</thead>
				<tbody>
					{submissions.map((submission) => (
						<tr key={submission.canonicalKey}>
							<td>
								<Link
									className="sequence-link"
									params={{ sequence: submission.sequence.toString(10) }}
									to="/submission/$sequence"
								>
									#{formatInteger(submission.sequence, locale)}
								</Link>
							</td>
							<td>
								<AddressLink address={submission.submitter} />
							</td>
							<td className="table-secondary">
								<span className="hash-value">
									<a
										aria-label={t("table.viewTransaction", { hash: submission.transactionHash })}
										className="hash-value__link"
										href={confluxScanTransactionUrl(submission.transactionHash)}
										rel="noopener noreferrer"
										target="_blank"
										title={submission.transactionHash}
									>
										{truncateMiddle(submission.transactionHash)}
										<ExternalLink aria-hidden="true" size={12} />
									</a>
									<CopyButton label={t("table.copyTransaction")} value={submission.transactionHash} />
								</span>
							</td>
							<td
								title={t("table.bytes", {
									count: formatInteger(submission.logicalSizeBytes, locale),
								})}
							>
								{formatBytes(submission.logicalSizeBytes, locale)}
							</td>
							<td className="table-secondary">{formatInteger(submission.sectorCount, locale)}</td>
							<td className="table-secondary">
								<span className="zero-fee">0 CFX</span>
							</td>
							<td>
								<time
									dateTime={timestampIso(submission.timestamp)}
									title={new Date(submission.timestamp * 1_000).toLocaleString(locale)}
								>
									{formatRelativeTime(submission.timestamp, now, locale)}
								</time>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

import { Link } from "@tanstack/react-router"
import { ExternalLink } from "lucide-react"
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
	return (
		<div className={compact ? "data-table-wrap data-table-wrap--compact" : "data-table-wrap"}>
			<table aria-label={caption} className="data-table">
				<caption className="sr-only">{caption}</caption>
				<thead>
					<tr>
						<th scope="col">Sequence</th>
						<th scope="col">Submitter</th>
						<th className="table-secondary" scope="col">
							Transaction
						</th>
						<th scope="col">Logical size</th>
						<th className="table-secondary" scope="col">
							Sectors
						</th>
						<th className="table-secondary" scope="col">
							Fee
						</th>
						<th scope="col">Age</th>
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
									#{formatInteger(submission.sequence)}
								</Link>
							</td>
							<td>
								<AddressLink address={submission.submitter} />
							</td>
							<td className="table-secondary">
								<span className="hash-value">
									<a
										aria-label={`View transaction ${submission.transactionHash} on ConfluxScan`}
										className="hash-value__link"
										href={confluxScanTransactionUrl(submission.transactionHash)}
										rel="noopener noreferrer"
										target="_blank"
										title={submission.transactionHash}
									>
										{truncateMiddle(submission.transactionHash)}
										<ExternalLink aria-hidden="true" size={12} />
									</a>
									<CopyButton label="Copy transaction hash" value={submission.transactionHash} />
								</span>
							</td>
							<td title={`${submission.logicalSizeBytes.toString(10)} bytes`}>
								{formatBytes(submission.logicalSizeBytes)}
							</td>
							<td className="table-secondary">{formatInteger(submission.sectorCount)}</td>
							<td className="table-secondary">
								<span className="zero-fee">0 CFX</span>
							</td>
							<td>
								<time
									dateTime={timestampIso(submission.timestamp)}
									title={new Date(submission.timestamp * 1_000).toLocaleString()}
								>
									{formatRelativeTime(submission.timestamp, now)}
								</time>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

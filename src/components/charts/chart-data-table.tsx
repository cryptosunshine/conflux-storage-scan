import type { StorageTimelinePoint } from "../../analytics/types"
import { formatBytes, formatInteger } from "../format"
import { formatUtcDate } from "./chart-format"

interface ChartDataTableProps {
	readonly kind: "storage" | "submissions"
	readonly points: readonly StorageTimelinePoint[]
}

export function ChartDataTable({ kind, points }: ChartDataTableProps) {
	const storage = kind === "storage"
	const caption = storage ? "Indexed storage growth daily values" : "Daily submission activity values"

	return (
		<details className="chart-data-disclosure">
			<summary>View daily values</summary>
			<div className="chart-data-table-wrap">
				<table aria-label={caption} className="chart-data-table">
					<caption className="sr-only">{caption}</caption>
					<thead>
						<tr>
							<th scope="col">UTC date</th>
							{storage ? (
								<>
									<th scope="col">Daily logical</th>
									<th scope="col">Total logical</th>
									<th scope="col">Allocated</th>
								</>
							) : (
								<>
									<th scope="col">Daily count</th>
									<th scope="col">Total indexed</th>
								</>
							)}
						</tr>
					</thead>
					<tbody>
						{points.map((point) => (
							<tr key={point.date}>
								<th scope="row">
									<time dateTime={`${point.date}T00:00:00.000Z`}>{formatUtcDate(point.date)}</time>
								</th>
								{storage ? (
									<>
										<td>{formatBytes(point.dailyLogicalBytes)}</td>
										<td>{formatBytes(point.cumulativeLogicalBytes)}</td>
										<td>{formatBytes(point.allocatedBytes)}</td>
									</>
								) : (
									<>
										<td>{formatInteger(point.dailySubmissionCount)}</td>
										<td>{formatInteger(point.cumulativeSubmissionCount)}</td>
									</>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	)
}

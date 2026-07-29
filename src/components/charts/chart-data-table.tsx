import { useTranslation } from "react-i18next"
import type { StorageTimelinePoint } from "../../analytics/types"
import { formatBytes, formatInteger } from "../format"
import { formatUtcDate } from "./chart-format"

interface ChartDataTableProps {
	readonly kind: "storage" | "submissions"
	readonly points: readonly StorageTimelinePoint[]
}

export function ChartDataTable({ kind, points }: ChartDataTableProps) {
	const { i18n, t } = useTranslation("analytics")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const storage = kind === "storage"
	const caption = storage ? t("table.storageCaption") : t("table.activityCaption")

	return (
		<details className="chart-data-disclosure">
			<summary>{t("table.viewDaily")}</summary>
			<div className="chart-data-table-wrap">
				<table aria-label={caption} className="chart-data-table">
					<caption className="sr-only">{caption}</caption>
					<thead>
						<tr>
							<th scope="col">{t("table.date")}</th>
							{storage ? (
								<>
									<th scope="col">{t("table.dailyLogical")}</th>
									<th scope="col">{t("table.totalLogical")}</th>
									<th scope="col">{t("table.allocated")}</th>
								</>
							) : (
								<>
									<th scope="col">{t("table.dailyCount")}</th>
									<th scope="col">{t("table.totalIndexed")}</th>
								</>
							)}
						</tr>
					</thead>
					<tbody>
						{points.map((point) => (
							<tr key={point.date}>
								<th scope="row">
									<time dateTime={`${point.date}T00:00:00.000Z`}>{formatUtcDate(point.date, locale)}</time>
								</th>
								{storage ? (
									<>
										<td>{formatBytes(point.dailyLogicalBytes, locale)}</td>
										<td>{formatBytes(point.cumulativeLogicalBytes, locale)}</td>
										<td>{formatBytes(point.allocatedBytes, locale)}</td>
									</>
								) : (
									<>
										<td>{formatInteger(point.dailySubmissionCount, locale)}</td>
										<td>{formatInteger(point.cumulativeSubmissionCount, locale)}</td>
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

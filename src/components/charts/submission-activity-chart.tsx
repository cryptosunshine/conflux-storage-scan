import { useId } from "react"
import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { StorageTimelinePoint } from "../../analytics/types"
import { formatInteger } from "../format"
import { ChartDataTable } from "./chart-data-table"
import { bigintToChartNumber, formatChartTick, formatUtcCompactDate, formatUtcDate } from "./chart-format"

interface SubmissionActivityChartProps {
	readonly compact?: boolean
	readonly points: readonly StorageTimelinePoint[]
}

export function SubmissionActivityChart({ compact = false, points }: SubmissionActivityChartProps) {
	const { i18n, t } = useTranslation("analytics")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const dailyLabel = t("activity.daily")
	const titleId = useId()
	const descriptionId = useId()
	const latest = points.at(-1)
	const data = points.map((point) => ({
		cumulative: bigintToChartNumber(point.cumulativeSubmissionCount),
		daily: bigintToChartNumber(point.dailySubmissionCount),
		date: point.date,
	}))
	const summary = latest
		? t("activity.summary", {
				daily: formatInteger(latest.dailySubmissionCount, locale),
				date: formatUtcDate(latest.date, locale),
				total: formatInteger(latest.cumulativeSubmissionCount, locale),
			})
		: t("activity.noHistory")

	return (
		<figure aria-describedby={descriptionId} aria-labelledby={titleId} className="chart-shell">
			<header className="chart-shell__header">
				<div className="chart-shell__title-row">
					<h2 id={titleId}>{t("activity.title")}</h2>
					{latest ? <strong>{formatInteger(latest.cumulativeSubmissionCount, locale)}</strong> : null}
				</div>
				<p id={descriptionId}>{summary}</p>
			</header>
			<section aria-label={t("activity.chartAria")} className="chart-canvas">
				<ResponsiveContainer
					height="100%"
					initialDimension={{ height: compact ? 168 : 300, width: 720 }}
					minWidth={0}
					width="100%"
				>
					<BarChart accessibilityLayer data={data} margin={{ bottom: 4, left: 0, right: 8, top: 8 }}>
						<CartesianGrid stroke="#EBECED" strokeDasharray="3 4" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							minTickGap={compact ? 48 : 28}
							tickFormatter={(date: string) =>
								compact ? formatUtcCompactDate(date, locale) : formatUtcDate(date, locale)
							}
							tickLine={false}
						/>
						<YAxis
							allowDecimals={false}
							axisLine={false}
							tickFormatter={(value: number) => formatChartTick(value, locale)}
							tickLine={false}
							width={compact ? 0 : 48}
						/>
						<Tooltip
							contentStyle={{
								background: "rgb(255 255 255 / 97%)",
								borderColor: "var(--color-border)",
								borderRadius: "0.65rem",
								boxShadow: "var(--shadow-popover)",
								fontSize: "0.75rem",
								padding: "0.7rem 0.8rem",
							}}
							formatter={(value, name, item) => [
								`${formatInteger(BigInt(Math.round(Number(value))), locale)}${
									name === dailyLabel
										? ` · ${t("activity.cumulativeValue", {
												count: formatInteger(BigInt(Math.round(Number(item.payload.cumulative))), locale),
											})}`
										: ""
								}`,
								String(name),
							]}
							labelFormatter={(date) => formatUtcDate(String(date), locale)}
						/>
						<Legend
							content={() => (
								<ul aria-label={t("activity.seriesAria")} className="chart-legend">
									<li>
										<span aria-hidden="true" className="chart-legend__bar" />
										{dailyLabel}
									</li>
									{compact ? null : (
										<li>
											<span>{t("activity.cumulative")}</span>
											<small>{t("activity.included")}</small>
										</li>
									)}
								</ul>
							)}
						/>
						<Bar
							dataKey="daily"
							fill="#4665F0"
							isAnimationActive={false}
							maxBarSize={26}
							name={dailyLabel}
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</section>
			{compact ? null : <ChartDataTable kind="submissions" points={points} />}
		</figure>
	)
}

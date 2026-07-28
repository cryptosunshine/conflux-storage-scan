import { useId } from "react"
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
	const titleId = useId()
	const descriptionId = useId()
	const latest = points.at(-1)
	const data = points.map((point) => ({
		cumulative: bigintToChartNumber(point.cumulativeSubmissionCount),
		daily: bigintToChartNumber(point.dailySubmissionCount),
		date: point.date,
	}))
	const summary = latest
		? `${formatInteger(latest.dailySubmissionCount)} submissions on ${formatUtcDate(
				latest.date,
			)}; ${formatInteger(latest.cumulativeSubmissionCount)} indexed in total.`
		: "No indexed submission history is available."

	return (
		<figure aria-describedby={descriptionId} aria-labelledby={titleId} className="chart-shell">
			<header className="chart-shell__header">
				<div className="chart-shell__title-row">
					<h2 id={titleId}>Daily submission activity</h2>
					{latest ? <strong>{formatInteger(latest.cumulativeSubmissionCount)}</strong> : null}
				</div>
				<p id={descriptionId}>{summary}</p>
			</header>
			<section aria-label="Daily submission activity chart" className="chart-canvas">
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
							tickFormatter={(date: string) => (compact ? formatUtcCompactDate(date) : formatUtcDate(date))}
							tickLine={false}
						/>
						<YAxis
							allowDecimals={false}
							axisLine={false}
							tickFormatter={formatChartTick}
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
								`${formatInteger(BigInt(Math.round(Number(value))))}${
									name === "Daily submissions"
										? ` · ${formatInteger(BigInt(Math.round(Number(item.payload.cumulative))))} cumulative`
										: ""
								}`,
								String(name),
							]}
							labelFormatter={(date) => formatUtcDate(String(date))}
						/>
						<Legend
							content={() => (
								<ul aria-label="Submission activity series" className="chart-legend">
									<li>
										<span aria-hidden="true" className="chart-legend__bar" />
										Daily submissions
									</li>
									{compact ? null : (
										<li>
											<span>Cumulative submissions</span>
											<small>Included in each tooltip</small>
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
							name="Daily submissions"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</section>
			{compact ? null : <ChartDataTable kind="submissions" points={points} />}
		</figure>
	)
}

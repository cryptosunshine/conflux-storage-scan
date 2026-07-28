import { useId } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { StorageTimelinePoint } from "../../analytics/types"
import { formatInteger } from "../format"
import { ChartDataTable } from "./chart-data-table"
import { bigintToChartNumber, formatChartTick, formatUtcDate } from "./chart-format"

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
				<div>
					<h2 id={titleId}>Daily submission activity</h2>
					<p id={descriptionId}>{summary}</p>
				</div>
				{latest ? <strong>{formatInteger(latest.cumulativeSubmissionCount)}</strong> : null}
			</header>
			<div aria-label="Daily submission activity chart" className="chart-canvas">
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
							tickFormatter={(date: string) => (compact ? date.slice(5) : formatUtcDate(date))}
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
									<li>
										<span>Cumulative submissions</span>
										<small>Included in each tooltip</small>
									</li>
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
			</div>
			{compact ? null : <ChartDataTable kind="submissions" points={points} />}
		</figure>
	)
}

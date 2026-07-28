import { useId } from "react"
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type { StorageTimelinePoint } from "../../analytics/types"
import { formatBytes } from "../format"
import { ChartDataTable } from "./chart-data-table"
import {
	bigintToChartNumber,
	formatChartTick,
	formatUtcDate,
	selectChartByteScale,
	utilizationPercent,
} from "./chart-format"

interface StorageGrowthChartProps {
	readonly compact?: boolean
	readonly points: readonly StorageTimelinePoint[]
}

export function StorageGrowthChart({ compact = false, points }: StorageGrowthChartProps) {
	const titleId = useId()
	const descriptionId = useId()
	const latest = points.at(-1)
	const byteScale = selectChartByteScale(points)
	const data = points.map((point) => ({
		allocated: bigintToChartNumber(point.allocatedBytes, byteScale.divisor),
		date: point.date,
		logical: bigintToChartNumber(point.cumulativeLogicalBytes, byteScale.divisor),
	}))
	const summary = latest
		? `Logical data reached ${formatBytes(latest.cumulativeLogicalBytes)} of ${formatBytes(
				latest.allocatedBytes,
			)} allocated on ${formatUtcDate(latest.date)} (${utilizationPercent(
				latest.cumulativeLogicalBytes,
				latest.allocatedBytes,
			)} utilization).`
		: "No indexed storage history is available."

	return (
		<figure aria-describedby={descriptionId} aria-labelledby={titleId} className="chart-shell">
			<header className="chart-shell__header">
				<div>
					<h2 id={titleId}>Indexed storage growth</h2>
					<p id={descriptionId}>{summary}</p>
				</div>
				{latest ? <strong>{formatBytes(latest.allocatedBytes)}</strong> : null}
			</header>
			<div aria-label={`Storage growth chart in ${byteScale.label}`} className="chart-canvas">
				<ResponsiveContainer
					height="100%"
					initialDimension={{ height: compact ? 168 : 300, width: 720 }}
					minWidth={0}
					width="100%"
				>
					<LineChart accessibilityLayer data={data} margin={{ bottom: 4, left: 0, right: 8, top: 8 }}>
						<CartesianGrid stroke="#EBECED" strokeDasharray="3 4" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							minTickGap={compact ? 48 : 28}
							tickFormatter={(date: string) => (compact ? date.slice(5) : formatUtcDate(date))}
							tickLine={false}
						/>
						<YAxis
							axisLine={false}
							tickFormatter={formatChartTick}
							tickLine={false}
							unit={` ${byteScale.label}`}
							width={compact ? 0 : 72}
						/>
						<Tooltip
							formatter={(value, name) => [
								`${formatChartTick(Number(value))} ${byteScale.label}`,
								String(name),
							]}
							labelFormatter={(date) => formatUtcDate(String(date))}
						/>
						<Legend iconType="plainline" />
						<Line
							dataKey="logical"
							dot={false}
							isAnimationActive={false}
							name="Logical data"
							stroke="#17B38A"
							strokeWidth={2.25}
							type="monotone"
						/>
						<Line
							dataKey="allocated"
							dot={false}
							isAnimationActive={false}
							name="Allocated storage"
							stroke="#7789D3"
							strokeDasharray="5 4"
							strokeWidth={2}
							type="stepAfter"
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
			{compact ? null : <ChartDataTable kind="storage" points={points} />}
		</figure>
	)
}

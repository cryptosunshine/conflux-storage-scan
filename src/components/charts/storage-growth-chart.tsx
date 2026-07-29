import { useId } from "react"
import { useTranslation } from "react-i18next"
import type { TooltipContentProps } from "recharts"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { StorageTimelinePoint } from "../../analytics/types"
import { formatBytes } from "../format"
import { ChartDataTable } from "./chart-data-table"
import {
	bigintToChartNumber,
	formatChartTick,
	formatUtcCompactDate,
	formatUtcDate,
	selectChartByteScale,
	utilizationPercent,
} from "./chart-format"

interface StorageGrowthChartProps {
	readonly compact?: boolean
	readonly points: readonly StorageTimelinePoint[]
}

interface StorageChartDatum {
	readonly allocated: number
	readonly date: string
	readonly logical: number
	readonly point: StorageTimelinePoint
}

function StorageTooltip({ active, payload }: TooltipContentProps) {
	const { i18n, t } = useTranslation("analytics")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const datum = payload.at(0)?.payload as StorageChartDatum | undefined
	if (!active || !datum) {
		return null
	}

	return (
		<div className="chart-tooltip">
			<time dateTime={`${datum.point.date}T00:00:00.000Z`}>{formatUtcDate(datum.point.date, locale)}</time>
			<dl>
				<div>
					<dt>{t("storage.dailyLogical")}</dt>
					<dd>{formatBytes(datum.point.dailyLogicalBytes, locale)}</dd>
				</div>
				<div>
					<dt>{t("storage.totalLogical")}</dt>
					<dd>{formatBytes(datum.point.cumulativeLogicalBytes, locale)}</dd>
				</div>
				<div>
					<dt>{t("storage.allocated")}</dt>
					<dd>{formatBytes(datum.point.allocatedBytes, locale)}</dd>
				</div>
				<div>
					<dt>{t("storage.utilization")}</dt>
					<dd>{utilizationPercent(datum.point.cumulativeLogicalBytes, datum.point.allocatedBytes)}</dd>
				</div>
			</dl>
		</div>
	)
}

export function StorageGrowthChart({ compact = false, points }: StorageGrowthChartProps) {
	const { i18n, t } = useTranslation("analytics")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const titleId = useId()
	const descriptionId = useId()
	const latest = points.at(-1)
	const byteScale = selectChartByteScale(points)
	const data = points.map((point) => ({
		allocated: bigintToChartNumber(point.allocatedBytes, byteScale.divisor),
		date: point.date,
		logical: bigintToChartNumber(point.cumulativeLogicalBytes, byteScale.divisor),
		point,
	}))
	const summary = latest
		? t("storage.summary", {
				allocated: formatBytes(latest.allocatedBytes, locale),
				date: formatUtcDate(latest.date, locale),
				logical: formatBytes(latest.cumulativeLogicalBytes, locale),
				utilization: utilizationPercent(latest.cumulativeLogicalBytes, latest.allocatedBytes),
			})
		: t("storage.noHistory")

	return (
		<figure aria-describedby={descriptionId} aria-labelledby={titleId} className="chart-shell">
			<header className="chart-shell__header">
				<div className="chart-shell__title-row">
					<h2 id={titleId}>{t("storage.title")}</h2>
					{latest ? <strong>{formatBytes(latest.allocatedBytes, locale)}</strong> : null}
				</div>
				<p id={descriptionId}>{summary}</p>
			</header>
			<section aria-label={t("storage.chartAria", { unit: byteScale.label })} className="chart-canvas">
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
							tickFormatter={(date: string) =>
								compact ? formatUtcCompactDate(date, locale) : formatUtcDate(date, locale)
							}
							tickLine={false}
						/>
						<YAxis
							axisLine={false}
							tickFormatter={(value: number) => formatChartTick(value, locale)}
							tickLine={false}
							unit={` ${byteScale.label}`}
							width={compact ? 0 : 72}
						/>
						<Tooltip content={StorageTooltip} />
						<Legend
							content={() => (
								<ul aria-label={t("storage.seriesAria")} className="chart-legend chart-legend--storage">
									<li>
										<span aria-hidden="true" className="chart-legend__line chart-legend__line--allocated" />
										{t("storage.allocatedStorage")}
									</li>
									<li>
										<span aria-hidden="true" className="chart-legend__line chart-legend__line--logical" />
										{t("storage.logicalData")}
									</li>
								</ul>
							)}
						/>
						<Line
							dataKey="logical"
							dot={false}
							isAnimationActive={false}
							name={t("storage.logicalData")}
							stroke="#17B38A"
							strokeWidth={2.25}
							type="monotone"
						/>
						<Line
							dataKey="allocated"
							dot={false}
							isAnimationActive={false}
							name={t("storage.allocatedStorage")}
							stroke="#7789D3"
							strokeDasharray="5 4"
							strokeWidth={2}
							type="stepAfter"
						/>
					</LineChart>
				</ResponsiveContainer>
			</section>
			{compact ? null : <ChartDataTable kind="storage" points={points} />}
		</figure>
	)
}

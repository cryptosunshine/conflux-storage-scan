import type { ReactNode } from "react"

export interface MetricCardProps {
	readonly label: string
	readonly value: ReactNode
	readonly detail?: ReactNode
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
	return (
		<section className="metric-block">
			<p className="metric-block__label">{label}</p>
			<p className="metric-block__value">{value}</p>
			{detail ? <div className="metric-block__detail">{detail}</div> : null}
		</section>
	)
}

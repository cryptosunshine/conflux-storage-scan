import { Link } from "@tanstack/react-router"
import type { StorageAnalyticsTimeline } from "../../analytics/types"
import { StorageGrowthChart } from "../../components/charts/storage-growth-chart"
import { SubmissionActivityChart } from "../../components/charts/submission-activity-chart"

interface AnalyticsPreviewCardsProps {
	readonly loading?: boolean
	readonly timeline?: StorageAnalyticsTimeline
}

export function AnalyticsPreviewCards({ loading = false, timeline }: AnalyticsPreviewCardsProps) {
	if (loading || !timeline) {
		return (
			<section
				aria-label="Loading storage trends…"
				className="analytics-preview-grid analytics-preview-grid--loading"
				role="status"
			>
				<div className="skeleton" />
				<div className="skeleton" />
			</section>
		)
	}

	if (timeline.points.length === 0) {
		return (
			<section aria-labelledby="analytics-empty-title" className="content-panel empty-state">
				<h2 id="analytics-empty-title">No indexed submission history is available yet</h2>
				<p>Storage trends will appear after canonical Submit events are indexed.</p>
			</section>
		)
	}

	return (
		<section aria-label="Storage trends" className="analytics-preview-grid">
			<Link
				aria-label="View storage growth analytics"
				className="analytics-preview-card"
				search={{ metric: "storage", range: "all" }}
				to="/analytics"
			>
				<StorageGrowthChart compact points={timeline.points} />
				<span aria-hidden="true" className="analytics-preview-card__action">
					View analytics →
				</span>
			</Link>
			<Link
				aria-label="View submission activity analytics"
				className="analytics-preview-card"
				search={{ metric: "submissions", range: "all" }}
				to="/analytics"
			>
				<SubmissionActivityChart compact points={timeline.points} />
				<span aria-hidden="true" className="analytics-preview-card__action">
					View analytics →
				</span>
			</Link>
		</section>
	)
}

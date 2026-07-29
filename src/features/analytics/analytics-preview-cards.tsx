import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { StorageAnalyticsTimeline } from "../../analytics/types"
import { StorageGrowthChart } from "../../components/charts/storage-growth-chart"
import { SubmissionActivityChart } from "../../components/charts/submission-activity-chart"

interface AnalyticsPreviewCardsProps {
	readonly loading?: boolean
	readonly timeline?: StorageAnalyticsTimeline
}

export function AnalyticsPreviewCards({ loading = false, timeline }: AnalyticsPreviewCardsProps) {
	const { t } = useTranslation("analytics")
	if (loading || !timeline) {
		return (
			<section
				aria-label={t("preview.loading")}
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
				<h2 id="analytics-empty-title">{t("preview.emptyTitle")}</h2>
				<p>{t("preview.emptyDescription")}</p>
			</section>
		)
	}

	return (
		<section aria-label={t("preview.sectionAria")} className="analytics-preview-grid">
			<Link
				aria-label={t("preview.viewStorage")}
				className="analytics-preview-card"
				search={{ metric: "storage", range: "all" }}
				to="/analytics"
			>
				<StorageGrowthChart compact points={timeline.points} />
				<span aria-hidden="true" className="analytics-preview-card__action">
					{t("preview.view")}
				</span>
			</Link>
			<Link
				aria-label={t("preview.viewActivity")}
				className="analytics-preview-card"
				search={{ metric: "submissions", range: "all" }}
				to="/analytics"
			>
				<SubmissionActivityChart compact points={timeline.points} />
				<span aria-hidden="true" className="analytics-preview-card__action">
					{t("preview.view")}
				</span>
			</Link>
		</section>
	)
}

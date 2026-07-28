import { createFileRoute } from "@tanstack/react-router"
import { AnalyticsPage } from "../features/analytics/analytics-page"
import { normalizeAnalyticsMetric, normalizeAnalyticsRange } from "./-route-validation"

function AnalyticsRoute() {
	const { metric, range } = Route.useSearch()
	return <AnalyticsPage metric={metric} range={range} />
}

export const Route = createFileRoute("/analytics")({
	component: AnalyticsRoute,
	validateSearch: (search: Record<string, unknown>) => ({
		metric: normalizeAnalyticsMetric(search.metric),
		range: normalizeAnalyticsRange(search.range),
	}),
})

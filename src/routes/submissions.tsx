import { createFileRoute } from "@tanstack/react-router"
import { normalizePage } from "./-route-validation"

const SKELETON_ROWS = ["row-a", "row-b", "row-c", "row-d", "row-e", "row-f", "row-g"] as const

function SubmissionsRoute() {
	const { page } = Route.useSearch()
	return (
		<section aria-labelledby="submissions-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">All activity</p>
					<h1 id="submissions-title">Storage submissions</h1>
				</div>
				<p>Page {page}</p>
			</header>
			<div aria-label="Loading storage submissions" className="route-list-skeleton" role="status">
				{SKELETON_ROWS.map((row) => (
					<div className="skeleton" key={row} />
				))}
			</div>
		</section>
	)
}

export const Route = createFileRoute("/submissions")({
	component: SubmissionsRoute,
	validateSearch: (search: Record<string, unknown>) => ({
		page: normalizePage(search.page),
	}),
})

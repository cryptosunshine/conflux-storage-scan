import { createFileRoute } from "@tanstack/react-router"
import { SubmissionsPage } from "../features/submissions/submissions-page"
import { normalizePage } from "./-route-validation"

function SubmissionsRoute() {
	const { page } = Route.useSearch()
	return <SubmissionsPage page={page} />
}

export const Route = createFileRoute("/submissions")({
	component: SubmissionsRoute,
	validateSearch: (search: Record<string, unknown>) => ({
		page: normalizePage(search.page),
	}),
})

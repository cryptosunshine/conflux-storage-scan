import { createFileRoute } from "@tanstack/react-router"
import { SubmissionDetailPage } from "../features/submission-detail/submission-detail-page"
import { parseSequenceParam } from "./-route-validation"

function SubmissionRoute() {
	const { sequence } = Route.useParams()
	return <SubmissionDetailPage sequence={sequence} />
}

export const Route = createFileRoute("/submission/$sequence")({
	component: SubmissionRoute,
	params: {
		parse: ({ sequence }) => ({ sequence: parseSequenceParam(sequence) }),
		stringify: ({ sequence }) => ({ sequence }),
	},
})

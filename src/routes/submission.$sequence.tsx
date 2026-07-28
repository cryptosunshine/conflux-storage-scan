import { createFileRoute } from "@tanstack/react-router"
import { parseSequenceParam } from "./-route-validation"

function SubmissionRoute() {
	const { sequence } = Route.useParams()
	return (
		<section aria-labelledby="submission-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">Submission</p>
					<h1 id="submission-title">Sequence {sequence}</h1>
				</div>
			</header>
			<div aria-label="Loading submission details" className="detail-skeleton" role="status">
				<div className="skeleton" />
				<div className="skeleton" />
				<div className="skeleton" />
			</div>
		</section>
	)
}

export const Route = createFileRoute("/submission/$sequence")({
	component: SubmissionRoute,
	params: {
		parse: ({ sequence }) => ({ sequence: parseSequenceParam(sequence) }),
		stringify: ({ sequence }) => ({ sequence }),
	},
})

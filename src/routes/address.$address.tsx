import { createFileRoute } from "@tanstack/react-router"
import { normalizePage, parseAddressParam } from "./-route-validation"

const SKELETON_ROWS = ["row-a", "row-b", "row-c", "row-d", "row-e"] as const

function AddressRoute() {
	const { address } = Route.useParams()
	const { page } = Route.useSearch()
	return (
		<section aria-labelledby="address-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">Submitter</p>
					<h1 className="breakable" id="address-title">
						{address}
					</h1>
				</div>
				<p>Page {page}</p>
			</header>
			<div aria-label="Loading address submissions" className="route-list-skeleton" role="status">
				{SKELETON_ROWS.map((row) => (
					<div className="skeleton" key={row} />
				))}
			</div>
		</section>
	)
}

export const Route = createFileRoute("/address/$address")({
	component: AddressRoute,
	params: {
		parse: ({ address }) => ({ address: parseAddressParam(address) }),
		stringify: ({ address }) => ({ address }),
	},
	validateSearch: (search: Record<string, unknown>) => ({
		page: normalizePage(search.page),
	}),
})

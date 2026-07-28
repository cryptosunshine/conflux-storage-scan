import { createFileRoute } from "@tanstack/react-router"
import { AddressPage } from "../features/address/address-page"
import { normalizePage, parseAddressParam } from "./-route-validation"

function AddressRoute() {
	const { address } = Route.useParams()
	const { page } = Route.useSearch()
	return <AddressPage address={address} page={page} />
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

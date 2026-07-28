import { createFileRoute } from "@tanstack/react-router"
import { WalletHistoryPage } from "../features/wallet-history/wallet-history-page"
import { normalizePage } from "./-route-validation"

function HistoryRoute() {
	const { page } = Route.useSearch()
	return <WalletHistoryPage page={page} />
}

export const Route = createFileRoute("/history")({
	component: HistoryRoute,
	validateSearch: (search: Record<string, unknown>) => ({
		page: normalizePage(search.page),
	}),
})

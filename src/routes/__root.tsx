import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { AppHeader } from "../components/app-header"
import { GlobalSearch } from "../features/search/global-search"

function RootLayout() {
	return (
		<div className="app-shell">
			<AppHeader />
			<main className="app-container app-main">
				<Outlet />
			</main>
			<footer className="app-footer">
				<div className="app-container app-footer__inner">
					<span>Conflux eSpace Testnet</span>
					<span>Read-only storage explorer</span>
				</div>
			</footer>
		</div>
	)
}

function NotFoundPage() {
	return (
		<section className="not-found">
			<p className="eyebrow">404</p>
			<h1>That explorer page does not exist</h1>
			<p>Search for a valid submission sequence or eSpace address.</p>
			<GlobalSearch />
			<Link className="secondary-button not-found__home" to="/">
				Return to overview
			</Link>
		</section>
	)
}

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFoundPage,
})

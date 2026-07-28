import { createRootRoute, type ErrorComponentProps, Link, Outlet } from "@tanstack/react-router"
import { AppHeader } from "../components/app-header"
import { GlobalSearch } from "../features/search/global-search"

function RootLayout() {
	return (
		<div className="app-shell">
			<a className="skip-link" href="#main-content">
				Skip to main content
			</a>
			<AppHeader />
			<main className="app-container app-main" id="main-content" tabIndex={-1}>
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

function RouteErrorPage({ error, reset }: ErrorComponentProps) {
	const validationError =
		error instanceof TypeError ||
		/sequence must be a non-negative integer|address must be a 42-character EVM address/i.test(error.message)
	const message = validationError
		? error.message
		: "This explorer page could not be loaded. Retry the route or search for another record."

	return (
		<div className="app-shell">
			<AppHeader />
			<main className="app-container app-main">
				<section className="not-found">
					<p className="eyebrow">{validationError ? "Invalid route parameter" : "Explorer error"}</p>
					<h1>{validationError ? "Invalid Explorer Link" : "Explorer Temporarily Unavailable"}</h1>
					<p>{message}</p>
					<GlobalSearch />
					<div className="route-error-actions">
						{validationError ? null : (
							<button className="secondary-button" onClick={reset} type="button">
								Retry Route
							</button>
						)}
						<Link className="secondary-button" to="/">
							Return to Overview
						</Link>
					</div>
				</section>
			</main>
		</div>
	)
}

export const Route = createRootRoute({
	component: RootLayout,
	errorComponent: RouteErrorPage,
	notFoundComponent: NotFoundPage,
})

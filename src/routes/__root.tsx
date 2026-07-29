import { createRootRoute, type ErrorComponentProps, Link, Outlet } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { AppFooter } from "../components/app-footer"
import { AppHeader } from "../components/app-header"
import { GlobalSearch } from "../features/search/global-search"

function RootLayout() {
	const { t } = useTranslation("common")
	return (
		<div className="app-shell">
			<a className="skip-link" href="#main-content">
				{t("skipToContent")}
			</a>
			<AppHeader />
			<main className="app-container app-main" id="main-content" tabIndex={-1}>
				<Outlet />
			</main>
			<AppFooter />
		</div>
	)
}

function NotFoundPage() {
	const { t } = useTranslation("common")
	return (
		<section className="not-found">
			<p className="eyebrow">404</p>
			<h1>{t("routes.notFoundTitle")}</h1>
			<p>{t("routes.notFoundDescription")}</p>
			<GlobalSearch />
			<Link className="secondary-button not-found__home" to="/">
				{t("actions.returnToOverview")}
			</Link>
		</section>
	)
}

function RouteErrorPage({ error, reset }: ErrorComponentProps) {
	const { t } = useTranslation(["common", "errors"])
	const validationError =
		error instanceof TypeError ||
		/sequence must be a non-negative integer|address must be a 42-character EVM address/i.test(error.message)
	const message = validationError
		? /sequence/i.test(error.message)
			? t("route.invalidSequence", { ns: "errors" })
			: t("route.invalidAddress", { ns: "errors" })
		: t("routes.errorMessage")

	return (
		<div className="app-shell">
			<AppHeader />
			<main className="app-container app-main">
				<section className="not-found">
					<p className="eyebrow">{validationError ? t("routes.invalidEyebrow") : t("routes.errorEyebrow")}</p>
					<h1>{validationError ? t("routes.invalidTitle") : t("routes.errorTitle")}</h1>
					<p>{message}</p>
					<GlobalSearch />
					<div className="route-error-actions">
						{validationError ? null : (
							<button className="secondary-button" onClick={reset} type="button">
								{t("actions.retryRoute")}
							</button>
						)}
						<Link className="secondary-button" to="/">
							{t("actions.returnToOverview")}
						</Link>
					</div>
				</section>
			</main>
			<AppFooter />
		</div>
	)
}

export const Route = createRootRoute({
	component: RootLayout,
	errorComponent: RouteErrorPage,
	notFoundComponent: NotFoundPage,
})

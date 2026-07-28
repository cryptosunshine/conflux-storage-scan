import { createFileRoute } from "@tanstack/react-router"

function OverviewRoute() {
	return (
		<section aria-labelledby="overview-title" className="page-section">
			<header className="page-heading">
				<div>
					<p className="eyebrow">FixedPriceFlow</p>
					<h1 id="overview-title">Storage overview</h1>
				</div>
				<p>Canonical storage submissions on Conflux eSpace Testnet.</p>
			</header>
			<div aria-label="Loading storage overview" className="route-skeleton" role="status">
				<div className="skeleton" />
				<div className="skeleton" />
				<div className="skeleton" />
			</div>
		</section>
	)
}

export const Route = createFileRoute("/")({
	component: OverviewRoute,
})

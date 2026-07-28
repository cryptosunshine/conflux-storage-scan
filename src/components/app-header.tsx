import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Link } from "@tanstack/react-router"
import { Database } from "lucide-react"
import { GlobalSearch } from "../features/search/global-search"

export function AppHeader() {
	return (
		<header className="app-header">
			<div className="app-container app-header__inner">
				<Link aria-label="Conflux Storage Scan overview" className="brand" to="/">
					<span aria-hidden="true" className="brand__mark">
						<Database size={18} strokeWidth={2.25} />
					</span>
					<span>Conflux Storage Scan</span>
				</Link>
				<nav aria-label="Primary" className="primary-nav">
					<Link activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }} to="/">
						Overview
					</Link>
					<Link activeProps={{ "aria-current": "page" }} search={{ page: 1 }} to="/submissions">
						Submissions
					</Link>
					<Link activeProps={{ "aria-current": "page" }} search={{ page: 1 }} to="/history">
						My Submissions
					</Link>
				</nav>
				<div className="header-search">
					<GlobalSearch compact />
				</div>
				<div className="network-badge" title="Current network">
					<span aria-hidden="true" />
					eSpace Testnet
				</div>
				<ConnectButton
					accountStatus={{ largeScreen: "full", smallScreen: "avatar" }}
					chainStatus={{ largeScreen: "icon", smallScreen: "none" }}
					showBalance={false}
				/>
			</div>
		</header>
	)
}

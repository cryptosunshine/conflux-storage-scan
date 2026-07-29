import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Link } from "@tanstack/react-router"
import { Database } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GlobalSearch } from "../features/search/global-search"

export function AppHeader() {
	const { t } = useTranslation("common")
	return (
		<header className="app-header">
			<div className="app-container app-header__inner">
				<Link aria-label={t("brand.overviewLabel")} className="brand" to="/">
					<span aria-hidden="true" className="brand__mark">
						<Database size={18} strokeWidth={2.25} />
					</span>
					<span>Conflux Storage Scan</span>
				</Link>
				<nav aria-label={t("nav.aria")} className="primary-nav">
					<Link activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }} to="/">
						{t("nav.overview")}
					</Link>
					<Link activeProps={{ "aria-current": "page" }} search={{ page: 1 }} to="/submissions">
						{t("nav.submissions")}
					</Link>
					<Link activeProps={{ "aria-current": "page" }} search={{ page: 1 }} to="/history">
						{t("nav.mySubmissions")}
					</Link>
				</nav>
				<div className="header-search">
					<GlobalSearch compact />
				</div>
				<div className="network-badge" title={t("network.current")}>
					<span aria-hidden="true" />
					{t("network.short")}
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

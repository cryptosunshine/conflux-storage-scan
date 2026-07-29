import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LanguageSelect } from "./language-select"

const CONTRACT_URL = "https://evmtestnet.confluxscan.org/address/0x3fF03285AA79027Ecc552432336FCB85eaD7199e"
const SOURCE_URL = "https://github.com/cryptosunshine/conflux-storage-scan"

export function AppFooter() {
	const { t } = useTranslation("common")
	return (
		<footer className="app-footer">
			<div className="app-container app-footer__inner">
				<div className="app-footer__identity">
					<strong translate="no">Conflux Storage Scan</strong>
					<p>{t("footer.description")}</p>
					<span className="app-footer__readonly">
						<span aria-hidden="true" />
						{t("footer.readOnly")}
					</span>
				</div>
				<div className="app-footer__resources">
					<nav aria-label={t("footer.resourcesAria")}>
						<a href="https://evmtestnet.confluxscan.org/" rel="noopener noreferrer" target="_blank">
							{t("footer.network")}
							<ExternalLink aria-hidden="true" size={13} />
						</a>
						<a href={CONTRACT_URL} rel="noopener noreferrer" target="_blank">
							{t("footer.contract")}
							<ExternalLink aria-hidden="true" size={13} />
						</a>
						<a href={SOURCE_URL} rel="noopener noreferrer" target="_blank">
							{t("footer.source")}
							<ExternalLink aria-hidden="true" size={13} />
						</a>
					</nav>
					<LanguageSelect />
				</div>
			</div>
		</footer>
	)
}

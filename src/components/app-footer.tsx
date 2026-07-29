import { useTranslation } from "react-i18next"
import { LanguageSelect } from "./language-select"

export function AppFooter() {
	const { t } = useTranslation("common")
	return (
		<footer className="app-footer">
			<div className="app-container app-footer__inner">
				<div className="app-footer__identity">
					<strong translate="no">Conflux Storage Scan</strong>
					<p>{t("footer.description")}</p>
				</div>
				<div className="app-footer__controls">
					<span className="app-footer__readonly">
						<span aria-hidden="true" />
						{t("footer.readOnly")}
					</span>
					<LanguageSelect />
				</div>
			</div>
		</footer>
	)
}

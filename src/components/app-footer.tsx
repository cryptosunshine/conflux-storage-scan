import { useTranslation } from "react-i18next"
import { LanguageSelect } from "./language-select"

export function AppFooter() {
	const { t } = useTranslation("common")
	return (
		<footer className="app-footer">
			<div className="app-container app-footer__inner">
				<div className="app-footer__meta">
					<span>{t("footer.network")}</span>
					<span>{t("footer.description")}</span>
				</div>
				<LanguageSelect />
			</div>
		</footer>
	)
}

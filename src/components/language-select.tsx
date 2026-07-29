import { useId } from "react"
import { useTranslation } from "react-i18next"
import type { SupportedLanguage } from "../i18n/i18n"

function resolvedLanguage(language: string): SupportedLanguage {
	return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
}

export function LanguageSelect() {
	const id = useId()
	const { i18n, t } = useTranslation("common")
	const language = resolvedLanguage(i18n.resolvedLanguage ?? i18n.language)

	return (
		<div className="language-select">
			<label htmlFor={id}>{t("footer.language")}</label>
			<select
				id={id}
				name="language"
				onChange={(event) => void i18n.changeLanguage(event.target.value)}
				value={language}
			>
				<option value="zh-CN">中文（简体）</option>
				<option value="en-US">English</option>
			</select>
		</div>
	)
}

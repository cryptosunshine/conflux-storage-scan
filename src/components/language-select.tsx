import * as Select from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
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
			<Select.Root onValueChange={(value) => void i18n.changeLanguage(value)} value={language}>
				<Select.Trigger className="language-select__trigger" id={id}>
					<Select.Value />
					<Select.Icon asChild>
						<ChevronDown aria-hidden="true" size={14} />
					</Select.Icon>
				</Select.Trigger>
				<Select.Portal>
					<Select.Content align="end" className="language-select__content" position="popper" side="top" sideOffset={8}>
						<Select.Viewport className="language-select__viewport">
							<Select.Item className="language-select__item" value="zh-CN">
								<Select.ItemText>中文（简体）</Select.ItemText>
								<Select.ItemIndicator asChild>
									<Check aria-hidden="true" size={14} />
								</Select.ItemIndicator>
							</Select.Item>
							<Select.Item className="language-select__item" value="en-US">
								<Select.ItemText>English</Select.ItemText>
								<Select.ItemIndicator asChild>
									<Check aria-hidden="true" size={14} />
								</Select.ItemIndicator>
							</Select.Item>
						</Select.Viewport>
					</Select.Content>
				</Select.Portal>
			</Select.Root>
		</div>
	)
}

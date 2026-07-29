import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it } from "vitest"
import { createAppI18n, LANGUAGE_STORAGE_KEY } from "../i18n/i18n"
import { LanguageSelect } from "./language-select"

describe("LanguageSelect", () => {
	beforeEach(() => {
		localStorage.clear()
		document.documentElement.lang = "en-US"
	})

	it("switches language accessibly and persists the choice", async () => {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, "en-US")
		const i18n = await createAppI18n({ registerReact: false })
		const user = userEvent.setup()
		render(
			<I18nextProvider i18n={i18n}>
				<LanguageSelect />
			</I18nextProvider>,
		)

		const language = screen.getByRole("combobox", { name: "Language" })
		expect(language).toHaveAttribute("aria-expanded", "false")
		expect(language).toHaveTextContent("English")

		await user.click(language)
		expect(language).toHaveAttribute("aria-expanded", "true")
		await user.click(screen.getByRole("option", { name: "中文（简体）" }))

		expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("中文（简体）")
		expect(document.documentElement.lang).toBe("zh-CN")
		expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh-CN")
	})
})

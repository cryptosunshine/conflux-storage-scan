import { describe, expect, it } from "vitest"
import { createAppI18n, LANGUAGE_STORAGE_KEY, supportedLanguages } from "./i18n"
import { englishResources } from "./resources/en-US"
import { chineseResources } from "./resources/zh-CN"

describe("application i18n", () => {
	it("provides matching English and Chinese resource trees", () => {
		expect(Object.keys(englishResources).sort()).toEqual(Object.keys(chineseResources).sort())
		for (const namespace of Object.keys(englishResources) as (keyof typeof englishResources)[]) {
			expect(Object.keys(englishResources[namespace]).sort()).toEqual(Object.keys(chineseResources[namespace]).sort())
		}
	})

	it("supports English and Simplified Chinese with English fallback", async () => {
		const instance = await createAppI18n({ detectLanguage: false, registerReact: false })

		expect(supportedLanguages).toEqual(["en-US", "zh-CN"])
		expect(instance.options.fallbackLng).toEqual(["en-US"])
		expect(instance.t("nav.overview", { lng: "en-US", ns: "common" })).toBe("Overview")
		expect(instance.t("nav.overview", { lng: "zh-CN", ns: "common" })).toBe("概览")
	})

	it("uses an application-specific language preference key", () => {
		expect(LANGUAGE_STORAGE_KEY).toBe("conflux-storage-scan-language")
	})
})

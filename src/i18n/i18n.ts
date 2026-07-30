import { createInstance, type i18n } from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import { englishResources } from "./resources/en-US"
import { chineseResources } from "./resources/zh-CN"

export const supportedLanguages = ["en-US", "zh-CN"] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]
export const LANGUAGE_STORAGE_KEY = "conflux-storage-scan-language"

const resources = {
	"en-US": englishResources,
	"zh-CN": chineseResources,
} as const

function normalizeDetectedLanguage(language: string): SupportedLanguage {
	return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
}

function syncDocumentLanguage(instance: i18n) {
	const language = normalizeDetectedLanguage(instance.resolvedLanguage ?? instance.language)
	document.documentElement.lang = language
}

export async function createAppI18n({
	detectLanguage = true,
	registerReact = true,
}: {
	readonly detectLanguage?: boolean
	readonly registerReact?: boolean
} = {}) {
	const instance = createInstance()

	if (detectLanguage) {
		instance.use(LanguageDetector)
	}
	if (registerReact) {
		instance.use(initReactI18next)
	}

	await instance.init({
		defaultNS: "common",
		detection: detectLanguage
			? {
					caches: ["localStorage"],
					convertDetectedLanguage: normalizeDetectedLanguage,
					lookupLocalStorage: LANGUAGE_STORAGE_KEY,
					order: ["localStorage", "navigator"],
				}
			: undefined,
		fallbackLng: ["en-US"],
		interpolation: {
			escapeValue: false,
		},
		lng: detectLanguage ? undefined : "en-US",
		ns: ["common", "explorer", "analytics", "errors", "wallet", "storagePoc"],
		resources,
		supportedLngs: supportedLanguages,
	})

	syncDocumentLanguage(instance)
	instance.on("languageChanged", () => syncDocumentLanguage(instance))
	return instance
}

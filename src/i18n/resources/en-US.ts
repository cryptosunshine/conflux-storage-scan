export const englishResources = {
	analytics: {},
	common: {
		actions: {
			next: "Next",
			previous: "Previous",
			retry: "Retry",
			search: "Search",
		},
		footer: {
			description: "Read-only storage explorer",
			language: "Language",
			network: "Conflux eSpace Testnet",
		},
		nav: {
			mySubmissions: "My Submissions",
			overview: "Overview",
			submissions: "Submissions",
		},
	},
	errors: {},
	explorer: {},
	wallet: {},
} as const

export type TranslationShape<T> = {
	readonly [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>
}

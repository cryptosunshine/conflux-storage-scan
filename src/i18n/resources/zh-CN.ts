import type { englishResources, TranslationShape } from "./en-US"

export const chineseResources = {
	analytics: {},
	common: {
		actions: {
			next: "下一页",
			previous: "上一页",
			retry: "重试",
			search: "搜索",
		},
		footer: {
			description: "只读存储浏览器",
			language: "语言",
			network: "Conflux eSpace 测试网",
		},
		nav: {
			mySubmissions: "我的提交",
			overview: "概览",
			submissions: "提交记录",
		},
	},
	errors: {},
	explorer: {},
	wallet: {},
} as const satisfies TranslationShape<typeof englishResources>

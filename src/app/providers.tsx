import "@rainbow-me/rainbowkit/styles.css"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext } from "react"
import { useTranslation } from "react-i18next"
import { type Config, WagmiProvider } from "wagmi"
import type { StorageDataSource } from "../data/storage-data-source"
import { wagmiConfig as defaultWagmiConfig } from "../wallet/config"
import { queryClient as defaultQueryClient } from "./query-client"

const StorageDataSourceContext = createContext<StorageDataSource | null>(null)

function LocalizedRainbowKitProvider({ children }: { readonly children: ReactNode }) {
	const { i18n } = useTranslation()
	const locale = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
	return (
		<RainbowKitProvider locale={locale} modalSize="compact">
			{children}
		</RainbowKitProvider>
	)
}

export interface AppProvidersProps {
	readonly children: ReactNode
	readonly dataSource: StorageDataSource
	readonly queryClient?: QueryClient
	readonly wagmiConfig?: Config
}

export function AppProviders({
	children,
	dataSource,
	queryClient = defaultQueryClient,
	wagmiConfig = defaultWagmiConfig,
}: AppProvidersProps) {
	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<LocalizedRainbowKitProvider>
					<StorageDataSourceContext value={dataSource}>{children}</StorageDataSourceContext>
				</LocalizedRainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	)
}

export function useStorageDataSource(): StorageDataSource {
	const dataSource = useContext(StorageDataSourceContext)
	if (!dataSource) {
		throw new Error("useStorageDataSource must be used within AppProviders")
	}
	return dataSource
}

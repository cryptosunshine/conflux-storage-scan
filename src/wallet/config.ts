import { type Config, type CreateConnectorFn, createConfig, http } from "wagmi"
import { injected, walletConnect } from "wagmi/connectors"
import { CONFLUX_ESPACE_TESTNET_RPC_URL } from "../chain/config"
import { createConfluxESpaceTestnetChain } from "./chains"

export const walletDiscoveryPolicy = {
	collapseInjectedProviders: false,
	multiInjectedProviderDiscovery: true,
} as const

export interface CreateWalletConfigOptions {
	readonly rpcUrl?: string
	readonly walletConnectProjectId?: string
}

export function createWalletConfig(options: CreateWalletConfigOptions = {}): Config {
	const rpcUrl = options.rpcUrl?.trim() || CONFLUX_ESPACE_TESTNET_RPC_URL
	const walletConnectProjectId = options.walletConnectProjectId?.trim()
	const chain = createConfluxESpaceTestnetChain(rpcUrl)
	const connectors: CreateConnectorFn[] = [
		injected({
			shimDisconnect: true,
		}),
	]
	if (walletConnectProjectId) {
		connectors.push(
			walletConnect({
				projectId: walletConnectProjectId,
				showQrModal: true,
			}),
		)
	}

	return createConfig({
		chains: [chain],
		connectors,
		multiInjectedProviderDiscovery: walletDiscoveryPolicy.multiInjectedProviderDiscovery,
		ssr: false,
		transports: {
			[chain.id]: http(rpcUrl),
		},
	})
}

export const wagmiConfig = createWalletConfig({
	rpcUrl: import.meta.env.VITE_CONFLUX_ESPACE_RPC_URL,
	walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
})

import { createPublicClient, http, type PublicClient } from "viem"
import { CONFLUX_ESPACE_TESTNET_RPC_URL, confluxESpaceTestnet } from "./config"

export function getConfiguredRpcUrl(): string {
	const configuredUrl = import.meta.env.VITE_CONFLUX_ESPACE_RPC_URL?.trim()
	return configuredUrl || CONFLUX_ESPACE_TESTNET_RPC_URL
}

export function createConfluxPublicClient(rpcUrl = getConfiguredRpcUrl()): PublicClient {
	return createPublicClient({
		chain: confluxESpaceTestnet,
		transport: http(rpcUrl, {
			timeout: 15_000,
		}),
	})
}

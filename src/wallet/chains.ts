import { type Chain, defineChain } from "viem"
import { CONFLUX_ESPACE_TESTNET_EXPLORER_URL, CONFLUX_ESPACE_TESTNET_RPC_URL } from "../chain/config"

export function createConfluxESpaceTestnetChain(rpcUrl = CONFLUX_ESPACE_TESTNET_RPC_URL): Chain {
	return defineChain({
		id: 71,
		name: "Conflux eSpace Testnet",
		nativeCurrency: {
			decimals: 18,
			name: "CFX",
			symbol: "CFX",
		},
		rpcUrls: {
			default: {
				http: [rpcUrl],
			},
		},
		blockExplorers: {
			default: {
				name: "ConfluxScan",
				url: CONFLUX_ESPACE_TESTNET_EXPLORER_URL,
			},
		},
		testnet: true,
	})
}

export const confluxESpaceTestnet = createConfluxESpaceTestnetChain()

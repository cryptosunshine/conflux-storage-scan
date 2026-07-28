import { describe, expect, it } from "vitest"
import { createWalletConfig, walletDiscoveryPolicy } from "./config"

describe("wallet configuration", () => {
	it("defines Conflux eSpace testnet using the explicit public RPC", () => {
		const config = createWalletConfig({
			rpcUrl: "https://rpc.example.invalid",
			walletConnectProjectId: "",
		})
		const chain = config.chains[0]

		expect(chain.id).toBe(71)
		expect(chain.nativeCurrency).toEqual({
			decimals: 18,
			name: "CFX",
			symbol: "CFX",
		})
		expect(chain.rpcUrls.default.http).toEqual(["https://rpc.example.invalid"])
		expect(chain.blockExplorers?.default.url).toBe("https://evmtestnet.confluxscan.org")
	})

	it("keeps EIP-6963 discovery enabled without collapsing providers", () => {
		const config = createWalletConfig({
			rpcUrl: "https://rpc.example.invalid",
			walletConnectProjectId: "",
		})

		expect(walletDiscoveryPolicy.multiInjectedProviderDiscovery).toBe(true)
		expect(walletDiscoveryPolicy.collapseInjectedProviders).toBe(false)
		expect(config.connectors.map((connector) => connector.name)).not.toContain("Browser Wallet")
	})

	it("omits WalletConnect when no project ID is configured", () => {
		const config = createWalletConfig({
			rpcUrl: "https://rpc.example.invalid",
			walletConnectProjectId: "   ",
		})

		expect(config.connectors.map((connector) => connector.id)).not.toContain("walletConnect")
		expect("writeContract" in config).toBe(false)
	})
})

import { describe, expect, it, vi } from "vitest"
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

	it("discovers two EIP-6963 wallets as separate named connectors", async () => {
		const config = createWalletConfig({
			rpcUrl: "https://rpc.example.invalid",
			walletConnectProjectId: "",
		})
		const provider = {
			request: vi.fn(async () => []),
		}
		const persistence = (
			config._internal.store as unknown as {
				readonly persist: { hasHydrated(): boolean }
			}
		).persist
		await vi.waitFor(() => {
			expect(persistence.hasHydrated()).toBe(true)
		})

		for (const [name, rdns, uuid] of [
			["Alpha Wallet", "org.example.alpha", "00000000-0000-4000-8000-000000000001"],
			["Beta Wallet", "org.example.beta", "00000000-0000-4000-8000-000000000002"],
		] as const) {
			window.dispatchEvent(
				new CustomEvent("eip6963:announceProvider", {
					detail: {
						info: {
							icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
							name,
							rdns,
							uuid,
						},
						provider,
					},
				}),
			)
		}

		await vi.waitFor(() => {
			expect(config.connectors.map((connector) => connector.name)).toEqual(
				expect.arrayContaining(["Alpha Wallet", "Beta Wallet"]),
			)
		})
	})
})

import { expect, test } from "@playwright/test"

test("wallet history is explicitly optional when disconnected", async ({ page }) => {
	await page.goto("/history?page=1")

	await expect(page.getByRole("heading", { name: /My Submissions/ })).toBeVisible()
	await expect(page.getByText(/connect a wallet to filter the public/i)).toBeVisible()
	await expect(page.getByText(/never requests a signature or transaction/i)).toBeVisible()
})

test("EIP-6963 discovery exposes two announced injected wallets", async ({ page }) => {
	await page.addInitScript(() => {
		const provider = {
			on: () => provider,
			removeListener: () => provider,
			request: async ({ method }: { method: string }) => {
				if (method === "eth_chainId") return "0x47"
				if (method === "eth_accounts" || method === "eth_requestAccounts") return []
				return null
			},
		}
		const wallets = [
			{
				info: {
					icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
					name: "Alpha Fixture Wallet",
					rdns: "ai.conflux.alpha-fixture",
					uuid: "350670db-19fa-4704-a166-e52e178b59d2",
				},
				provider,
			},
			{
				info: {
					icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
					name: "Beta Fixture Wallet",
					rdns: "ai.conflux.beta-fixture",
					uuid: "350670db-19fa-4704-a166-e52e178b59d3",
				},
				provider,
			},
		]
		window.addEventListener("eip6963:requestProvider", () => {
			for (const detail of wallets) {
				window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }))
			}
		})
	})
	await page.goto("/")

	await page.getByRole("button", { name: "Connect Wallet" }).click()
	await expect(page.getByText("Alpha Fixture Wallet")).toBeVisible()
	await expect(page.getByText("Beta Fixture Wallet")).toBeVisible()
})

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "../app/app"
import { AppProviders } from "../app/providers"
import { createFixtureDataSource } from "../data/fixture-data-source"

describe("App", () => {
	it("renders the official brand and read-only trust links", async () => {
		const dataSource = createFixtureDataSource({
			allocatedSectorCount: 0n,
			contractSubmissionCount: 0n,
			submissions: [],
		})
		render(
			<AppProviders dataSource={dataSource}>
				<App />
			</AppProviders>,
		)

		const brand = await screen.findByRole("link", { name: "Conflux Storage Scan overview" })
		expect(brand).toHaveTextContent("Conflux Storage Scan")
		expect(brand.querySelector("img")).toHaveAttribute("src", "/espace-icon.svg")
		expect(brand.querySelector("svg")).not.toBeInTheDocument()
		expect(within(brand).getByText("Conflux Storage Scan")).toHaveAttribute("translate", "no")

		const footer = screen.getByRole("contentinfo")
		expect(footer).toHaveTextContent("Read-only explorer for FixedPriceFlow storage submissions.")
		expect(footer).toHaveTextContent("Read-only")
		expect(within(footer).getByText("Conflux Storage Scan")).toHaveAttribute("translate", "no")

		for (const link of [
			screen.getByRole("link", { name: "Conflux eSpace Testnet" }),
			screen.getByRole("link", { name: "FixedPriceFlow 0x3fF0…7199" }),
			screen.getByRole("link", { name: "GitHub" }),
		]) {
			expect(link).toHaveAttribute("target", "_blank")
			expect(link).toHaveAttribute("rel", "noopener noreferrer")
		}
		expect(screen.getByRole("link", { name: "Conflux eSpace Testnet" })).toHaveAttribute(
			"href",
			"https://evmtestnet.confluxscan.org/",
		)
		expect(screen.getByRole("link", { name: "FixedPriceFlow 0x3fF0…7199" })).toHaveAttribute(
			"href",
			"https://evmtestnet.confluxscan.org/address/0x3fF03285AA79027Ecc552432336FCB85eaD7199e",
		)
		expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
			"href",
			"https://github.com/cryptosunshine/conflux-storage-scan",
		)
	})
})

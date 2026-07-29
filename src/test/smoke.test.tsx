import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "../app/app"
import { AppProviders } from "../app/providers"
import { createFixtureDataSource } from "../data/fixture-data-source"

describe("App", () => {
	it("renders the official brand and compact read-only footer controls", async () => {
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
		expect(within(footer).getByText("Conflux Storage Scan")).toHaveAttribute("translate", "no")
		expect(within(footer).queryByRole("link")).not.toBeInTheDocument()

		const readOnly = within(footer).getByText("Read-only", { exact: true })
		const language = within(footer).getByRole("combobox", { name: "Language" })
		const controls = footer.querySelector(".app-footer__controls")
		expect(controls).toContainElement(readOnly)
		expect(controls).toContainElement(language)
	})
})

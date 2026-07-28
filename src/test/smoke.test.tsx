import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "../app/app"
import { AppProviders } from "../app/providers"
import { createFixtureDataSource } from "../data/fixture-data-source"

describe("App", () => {
	it("renders the product name", async () => {
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

		expect(await screen.findByText("Conflux Storage Scan")).toBeInTheDocument()
	})
})

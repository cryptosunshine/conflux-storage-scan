import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { renderWithDataSource } from "../../test/render"
import { DashboardPage } from "./dashboard-page"

describe("DashboardPage", () => {
	it("separates contract, indexed, logical, allocated, and fee metrics", async () => {
		const submissions = Array.from({ length: 6 }, (_, sequence) => createSubmissionFixture(BigInt(sequence)))
		const source = createFixtureDataSource({
			allocatedSectorCount: 128n,
			contractSubmissionCount: 7n,
			headBlock: 258_293_674n,
			submissions,
		})
		await renderWithDataSource(<DashboardPage />, source)

		expect(await screen.findByText("Contract submissions")).toBeInTheDocument()
		expect(screen.getByText("Indexed submissions")).toBeInTheDocument()
		expect(screen.getByText("Indexed logical data")).toBeInTheDocument()
		expect(screen.getByText("Allocated storage")).toBeInTheDocument()
		expect(screen.getByText("Storage fee")).toBeInTheDocument()
		expect(screen.getAllByText("0 CFX").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText(/data may be incomplete/i)).toBeInTheDocument()

		const table = screen.getByRole("table", { name: /recent submissions/i })
		expect(within(table).getAllByRole("row")).toHaveLength(6)
		expect(screen.queryByText(/download/i)).not.toBeInTheDocument()
	})
})

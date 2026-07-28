import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { renderWithDataSource } from "../../test/render"
import { SubmissionDetailPage } from "./submission-detail-page"

describe("SubmissionDetailPage", () => {
	it("renders normalized event semantics and read-only chain provenance", async () => {
		const submission = createSubmissionFixture(7n, {
			endSectorExclusive: 22n,
			nodeRoots: [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`],
			sectorCount: 12n,
			startSector: 10n,
			tags: "0xabcd",
		})
		const source = createFixtureDataSource({
			allocatedSectorCount: 22n,
			contractSubmissionCount: 8n,
			submissions: [submission],
		})
		await renderWithDataSource(<SubmissionDetailPage sequence="7" />, source)

		expect(await screen.findByRole("heading", { name: "Submission #7" })).toBeInTheDocument()
		expect(screen.getByText("Submission identity")).toBeInTheDocument()
		expect(screen.getByText("Indexed on eSpace")).toBeInTheDocument()
		expect(screen.getByText("Start sector")).toBeInTheDocument()
		expect(screen.getByText("End sector (exclusive)")).toBeInTheDocument()
		expect(screen.getByText("Sector count")).toBeInTheDocument()
		expect(screen.getByText("Node count")).toBeInTheDocument()
		expect(screen.getByText("Tags")).toBeInTheDocument()
		expect(screen.getByText("Block")).toBeInTheDocument()
		expect(screen.getByText("Transaction")).toBeInTheDocument()
		expect(screen.getByText("Timestamp")).toBeInTheDocument()
		expect(screen.getByText("Contract")).toBeInTheDocument()
		expect(screen.getByText("Implementation")).toBeInTheDocument()
		expect(screen.getByText("0 CFX")).toBeInTheDocument()
		expect(screen.queryByText(/file hash|gas fee|gas used|download/i)).not.toBeInTheDocument()
	})

	it("shows a clear empty state for an unknown sequence", async () => {
		const source = createFixtureDataSource({
			allocatedSectorCount: 0n,
			contractSubmissionCount: 0n,
			submissions: [],
		})
		await renderWithDataSource(<SubmissionDetailPage sequence="999" />, source)

		expect(await screen.findByRole("heading", { name: /submission not found/i })).toBeInTheDocument()
	})
})

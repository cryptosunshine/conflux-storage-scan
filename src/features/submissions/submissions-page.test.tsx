import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { testI18n } from "../../test/i18n"
import { renderWithDataSource } from "../../test/render"
import { SubmissionsPage } from "./submissions-page"

describe("SubmissionsPage", () => {
	it("renders the canonical submissions table in Simplified Chinese", async () => {
		await testI18n.changeLanguage("zh-CN")
		const source = createFixtureDataSource({
			allocatedSectorCount: 1n,
			contractSubmissionCount: 1n,
			submissions: [createSubmissionFixture(0n)],
		})
		await renderWithDataSource(<SubmissionsPage page={1} />, source)

		expect(await screen.findByRole("heading", { name: "存储提交记录" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "序号" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "提交者" })).toBeInTheDocument()
	})

	it("renders the read-only table contract and requests a 20-row URL page", async () => {
		const source = createFixtureDataSource({
			allocatedSectorCount: 24n,
			contractSubmissionCount: 2n,
			submissions: [createSubmissionFixture(0n), createSubmissionFixture(1n)],
		})
		const listSubmissions = vi.spyOn(source, "listSubmissions")
		await renderWithDataSource(<SubmissionsPage page={1} />, source)

		expect(await screen.findByRole("columnheader", { name: "Sequence" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Submitter" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Transaction" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Logical size" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Sectors" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Fee" })).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Age" })).toBeInTheDocument()
		expect(screen.getAllByText("0 CFX")).toHaveLength(2)
		expect(screen.queryByText(/download/i)).not.toBeInTheDocument()
		expect(listSubmissions).toHaveBeenCalledWith({ page: 1, pageSize: 20 })

		const transaction = screen.getAllByRole("link", { name: /view transaction/i })[0]
		expect(transaction).toHaveAttribute("target", "_blank")
		expect(transaction).toHaveAttribute("rel", "noopener noreferrer")
		expect(transaction).toHaveAttribute("href", expect.stringContaining("evmtestnet.confluxscan.org/tx/"))
	})
})

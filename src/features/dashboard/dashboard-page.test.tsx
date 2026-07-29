import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { testI18n } from "../../test/i18n"
import { renderWithDataSource } from "../../test/render"
import { DashboardPage } from "./dashboard-page"

describe("DashboardPage", () => {
	it("renders the overview in Simplified Chinese", async () => {
		await testI18n.changeLanguage("zh-CN")
		const source = createFixtureDataSource({
			allocatedSectorCount: 1n,
			contractSubmissionCount: 1n,
			submissions: [createSubmissionFixture(0n)],
		})
		await renderWithDataSource(<DashboardPage />, source)

		expect(await screen.findByRole("heading", { name: "存储概览" })).toBeInTheDocument()
		expect(screen.getByText("Conflux eSpace 存储")).toBeInTheDocument()
		expect(screen.getByText("浏览从 Conflux eSpace 测试网索引的 FixedPriceFlow 规范存储提交。")).toBeInTheDocument()
		expect(screen.getByText("合约提交数")).toBeInTheDocument()
		expect(screen.getByText("FixedPriceFlow 提交序号计数")).toBeInTheDocument()
		expect(screen.getByText("已验证的规范 Submit 事件")).toBeInTheDocument()
		expect(screen.getByText("已索引提交声明的逻辑字节总量")).toBeInTheDocument()
		expect(screen.getByText("存储费用")).toBeInTheDocument()
		expect(screen.getByText("当前测试网不收取存储费用")).toBeInTheDocument()
		expect(screen.getAllByText("0 CFX").length).toBeGreaterThanOrEqual(1)
	})

	it("separates contract, indexed, logical, allocated, and fee metrics", async () => {
		const submissions = Array.from({ length: 6 }, (_, sequence) => createSubmissionFixture(BigInt(sequence)))
		const source = createFixtureDataSource({
			allocatedSectorCount: 128n,
			contractSubmissionCount: 7n,
			headBlock: 258_293_674n,
			submissions,
		})
		await renderWithDataSource(<DashboardPage />, source)

		expect(await screen.findByText("Conflux eSpace Storage")).toBeInTheDocument()
		expect(
			screen.getByText("Explore canonical FixedPriceFlow submissions indexed from Conflux eSpace Testnet."),
		).toBeInTheDocument()
		expect(await screen.findByText("Contract submissions")).toBeInTheDocument()
		expect(screen.getByText("FixedPriceFlow sequence counter")).toBeInTheDocument()
		expect(screen.getByText("Indexed submissions")).toBeInTheDocument()
		expect(screen.getByText("Validated canonical Submit events")).toBeInTheDocument()
		expect(screen.getByText("Indexed logical data")).toBeInTheDocument()
		expect(screen.getByText("Total bytes declared by indexed submissions")).toBeInTheDocument()
		expect(screen.getAllByText("Allocated storage").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Storage fee")).toBeInTheDocument()
		expect(screen.getByText("No storage fee on this testnet")).toBeInTheDocument()
		expect(screen.getAllByText("0 CFX").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText(/data may be incomplete/i)).toBeInTheDocument()

		const storageAnalytics = await screen.findByRole("link", {
			name: /view storage growth analytics/i,
		})
		expect(storageAnalytics).toHaveAttribute("href", "/analytics?metric=storage&range=all")
		expect(
			screen.getByRole("link", {
				name: /view submission activity analytics/i,
			}),
		).toHaveAttribute("href", "/analytics?metric=submissions&range=all")

		const table = screen.getByRole("table", { name: /recent submissions/i })
		expect(storageAnalytics.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(within(table).getAllByRole("row")).toHaveLength(6)
		expect(screen.queryByText(/download/i)).not.toBeInTheDocument()
	})
})

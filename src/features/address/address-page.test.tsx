import { screen } from "@testing-library/react"
import { getAddress } from "viem"
import { describe, expect, it, vi } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { testI18n } from "../../test/i18n"
import { renderWithDataSource } from "../../test/render"
import { AddressPage } from "./address-page"

describe("AddressPage", () => {
	it("renders address activity in Simplified Chinese", async () => {
		await testI18n.changeLanguage("zh-CN")
		const address = getAddress("0xe9B0afd0DccB44Bc6e0a49f8032Cc7815A221ebE")
		const source = createFixtureDataSource({
			allocatedSectorCount: 1n,
			contractSubmissionCount: 1n,
			submissions: [createSubmissionFixture(0n, { submitter: address })],
		})
		await renderWithDataSource(<AddressPage address={address} page={1} />, source)

		expect(await screen.findByRole("heading", { name: "地址活动" })).toBeInTheDocument()
		expect(screen.getByText("已索引提交数")).toBeInTheDocument()
	})

	it("summarizes and paginates by event submitter", async () => {
		const address = getAddress("0xe9B0afd0DccB44Bc6e0a49f8032Cc7815A221ebE")
		const submissions = Array.from({ length: 21 }, (_, sequence) =>
			createSubmissionFixture(BigInt(sequence), {
				logicalSizeBytes: 1_024n,
				submitter: address,
			}),
		)
		submissions.push(
			createSubmissionFixture(99n, {
				submitter: "0x2222222222222222222222222222222222222222",
			}),
		)
		const source = createFixtureDataSource({
			allocatedSectorCount: 264n,
			contractSubmissionCount: 22n,
			submissions,
		})
		const listBySubmitter = vi.spyOn(source, "listBySubmitter")
		await renderWithDataSource(<AddressPage address={address} page={1} />, source)

		expect(await screen.findByText(address)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Copy full submitter address" })).toBeInTheDocument()
		expect(screen.getByText("Indexed submissions")).toBeInTheDocument()
		expect(screen.getByText("21")).toBeInTheDocument()
		expect(screen.getByText("Indexed logical data")).toBeInTheDocument()
		expect(screen.getByText("21 KiB")).toBeInTheDocument()
		expect(listBySubmitter).toHaveBeenCalledWith({
			page: 1,
			pageSize: 20,
			submitter: address,
		})
		expect(screen.getByRole("link", { name: /next page/i })).toHaveAttribute("href", `/address/${address}?page=2`)
	})
})

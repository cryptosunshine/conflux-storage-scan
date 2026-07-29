import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import type { Address } from "viem"
import { describe, expect, it, vi } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { testI18n } from "../../test/i18n"
import { renderWithDataSource } from "../../test/render"
import { WalletHistoryContent } from "./wallet-history-page"

const firstAddress = "0x1111111111111111111111111111111111111111" as const
const secondAddress = "0x2222222222222222222222222222222222222222" as const

function sourceWithAccounts() {
	return createFixtureDataSource({
		allocatedSectorCount: 24n,
		contractSubmissionCount: 2n,
		submissions: [
			createSubmissionFixture(0n, { submitter: firstAddress }),
			createSubmissionFixture(1n, { submitter: secondAddress }),
		],
	})
}

describe("WalletHistoryContent", () => {
	it("renders the disconnected wallet state in Simplified Chinese", async () => {
		await testI18n.changeLanguage("zh-CN")
		await renderWithDataSource(<WalletHistoryContent page={1} />, sourceWithAccounts())

		expect(await screen.findByRole("heading", { name: "我的提交" })).toBeInTheDocument()
		expect(screen.getByText(/连接钱包后可按当前账户筛选/)).toBeInTheDocument()
		expect(screen.getByText(/绝不会请求签名或交易/)).toBeInTheDocument()
	})

	it("asks a disconnected visitor to connect without hiding public navigation", async () => {
		await renderWithDataSource(<WalletHistoryContent page={1} />, sourceWithAccounts())

		expect(await screen.findByRole("heading", { name: /my submissions/i })).toBeInTheDocument()
		expect(screen.getByText(/connect a wallet to filter/i)).toBeInTheDocument()
		expect(screen.queryByText(/my files/i)).not.toBeInTheDocument()
	})

	it("filters chain 71 data by the active account", async () => {
		const source = sourceWithAccounts()
		const listBySubmitter = vi.spyOn(source, "listBySubmitter")
		await renderWithDataSource(<WalletHistoryContent address={firstAddress} chainId={71} page={1} />, source)

		expect(await screen.findByRole("table", { name: /my indexed submissions/i })).toBeInTheDocument()
		expect(listBySubmitter).toHaveBeenCalledWith({
			page: 1,
			pageSize: 20,
			submitter: firstAddress,
		})
	})

	it("keeps public Conflux data visible on another wallet chain and offers switching", async () => {
		const user = userEvent.setup()
		const switchChain = vi.fn()
		await renderWithDataSource(
			<WalletHistoryContent address={firstAddress} chainId={1} onSwitchChain={switchChain} page={1} />,
			sourceWithAccounts(),
		)

		expect(await screen.findByRole("table", { name: /my indexed submissions/i })).toBeInTheDocument()
		expect(screen.getByText(/wallet is on chain 1/i)).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: /switch to espace testnet/i }))
		expect(switchChain).toHaveBeenCalledOnce()
	})

	it("changes the account query when the connected account changes", async () => {
		const user = userEvent.setup()
		const source = sourceWithAccounts()
		const listBySubmitter = vi.spyOn(source, "listBySubmitter")

		function AccountHarness() {
			const [address, setAddress] = useState<Address>(firstAddress)
			return (
				<>
					<button onClick={() => setAddress(secondAddress)} type="button">
						Switch test account
					</button>
					<WalletHistoryContent address={address} chainId={71} page={1} />
				</>
			)
		}

		await renderWithDataSource(<AccountHarness />, source)
		await waitFor(() =>
			expect(listBySubmitter).toHaveBeenCalledWith({
				page: 1,
				pageSize: 20,
				submitter: firstAddress,
			}),
		)
		await user.click(screen.getByRole("button", { name: /switch test account/i }))
		await waitFor(() =>
			expect(listBySubmitter).toHaveBeenCalledWith({
				page: 1,
				pageSize: 20,
				submitter: secondAddress,
			}),
		)
	})
})

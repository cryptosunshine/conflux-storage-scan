import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PublicClient } from "viem"
import { describe, expect, it, vi } from "vitest"
import {
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../../chain/config"
import type { StorageSyncTransport, SyncState } from "../../chain/sync/sync-submissions"
import { DataState } from "../../components/data-state"
import type { StorageRepository } from "../../data/indexed-db/storage-db"
import { createLiveRpcDataSource } from "../../data/live-rpc-data-source"
import type { StorageDataSource } from "../../data/storage-data-source"
import { renderWithDataSource } from "../../test/render"
import { RebuildIndexButton } from "./rebuild-index-button"

function dataSourceMock(): StorageDataSource {
	return {
		getSubmission: vi.fn(),
		getSubmitterSummary: vi.fn(),
		getSummary: vi.fn(),
		getSyncState: vi.fn((): SyncState => ({ status: "idle" })),
		listBySubmitter: vi.fn(),
		listSubmissions: vi.fn(),
		rebuildLocalIndex: vi.fn(async () => {}),
		sync: vi.fn(
			async (): Promise<SyncState> => ({
				headBlock: 100n,
				status: "fresh",
				syncedAt: Date.UTC(2026, 6, 28),
			}),
		),
	}
}

describe("explorer recovery states", () => {
	it("distinguishes wrong-chain verification from an implementation change", () => {
		const { rerender } = render(
			<DataState
				state={{
					error: {
						code: "CHAIN_ID_MISMATCH",
						message: "Connected chain is 1; expected 71",
					},
					status: "incompatible-contract",
				}}
			/>,
		)

		expect(screen.getByText("Wrong network")).toBeInTheDocument()
		expect(screen.getByText(/connected chain is 1; expected 71/i)).toBeInTheDocument()

		rerender(
			<DataState
				state={{
					error: {
						code: "IMPLEMENTATION_MISMATCH",
						message: "Implementation changed",
					},
					status: "incompatible-contract",
				}}
			/>,
		)
		expect(screen.getByText("Contract update detected")).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: /continue|bypass/i })).not.toBeInTheDocument()
	})

	it("keeps cached content visible during a transient RPC failure", () => {
		render(
			<>
				<p>Cached submission #42</p>
				<DataState
					state={{
						error: { code: "RPC_TIMEOUT", message: "RPC timed out" },
						lastSuccessAt: Date.UTC(2026, 6, 28),
						status: "stale",
					}}
				/>
			</>,
		)

		expect(screen.getByText("Cached submission #42")).toBeInTheDocument()
		expect(screen.getByText("Showing cached data")).toBeInTheDocument()
		expect(screen.getByText(/last synced/i)).toBeInTheDocument()
	})

	it("marks sequence gaps as partial and offers retry when no cache exists", async () => {
		const user = userEvent.setup()
		const retry = vi.fn()
		render(
			<DataState
				onRetry={retry}
				state={{
					error: { code: "SEQUENCE_GAP", message: "Missing submission sequence 7" },
					gaps: [7n],
					status: "partial",
				}}
			/>,
		)

		expect(screen.getByText("Data may be incomplete")).toBeInTheDocument()
		expect(screen.queryByText(/up to date|sync complete/i)).not.toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: "Retry" }))
		expect(retry).toHaveBeenCalledOnce()
	})

	it("requires confirmation, clears only the local namespace, and then resyncs", async () => {
		const user = userEvent.setup()
		const dataSource = dataSourceMock()
		await renderWithDataSource(<RebuildIndexButton />, dataSource)

		await user.click(screen.getByRole("button", { name: "Rebuild local index" }))

		const dialog = screen.getByRole("alertdialog", { name: "Rebuild local index?" })
		expect(dialog).toHaveTextContent(/conflux storage scan local index in this browser/i)
		expect(dialog).toHaveTextContent(/does not delete or change chain data/i)
		expect(dataSource.rebuildLocalIndex).not.toHaveBeenCalled()

		await user.click(screen.getByRole("button", { name: "Confirm rebuild" }))

		await waitFor(() => expect(dataSource.rebuildLocalIndex).toHaveBeenCalledOnce())
		expect(dataSource.sync).toHaveBeenCalledOnce()
		expect(vi.mocked(dataSource.rebuildLocalIndex).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(dataSource.sync).mock.invocationCallOrder[0] ?? 0,
		)
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
	})

	it("classifies an unreadable IndexedDB checkpoint as a rebuildable local-index failure", async () => {
		const repository = {
			getCheckpoint: vi.fn(async () => {
				throw new SyntaxError("Invalid persisted bigint")
			}),
			namespace: "test:71:fixed-price-flow",
		} as unknown as StorageRepository
		const transport: StorageSyncTransport = {
			getBlock: vi.fn(),
			getHeadBlock: vi.fn(async () => ({
				hash: `0x${"11".repeat(32)}` as const,
				number: 100n,
			})),
			getSubmitLogs: vi.fn(),
			verifyDeployment: vi.fn(async () => ({
				beacon: FIXED_PRICE_FLOW_BEACON,
				chainId: 71 as const,
				implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
				market: FIXED_PRICE_FLOW_MARKET,
				proxy: FIXED_PRICE_FLOW_PROXY,
			})),
		}
		const source = createLiveRpcDataSource({
			client: {} as PublicClient,
			repository,
			transport,
		})

		await expect(source.sync()).resolves.toMatchObject({
			error: {
				code: "CACHE_CORRUPT",
			},
			status: "partial",
		})
	})
})

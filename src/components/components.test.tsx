import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CopyButton } from "./copy-button"
import { DataState } from "./data-state"
import { Pagination } from "./pagination"

describe("shared explorer components", () => {
	it("keeps stale data visible with the last sync time and a retry action", async () => {
		const user = userEvent.setup()
		const retry = vi.fn()
		render(
			<DataState
				onRetry={retry}
				state={{
					error: { code: "RPC_TIMEOUT", message: "Timed out" },
					lastSuccessAt: Date.UTC(2026, 6, 28),
					status: "stale",
				}}
			/>,
		)

		expect(screen.getByText(/showing cached data/i)).toBeInTheDocument()
		expect(screen.getByText(/last synced/i)).toBeInTheDocument()
		await user.click(screen.getByRole("button", { name: /retry/i }))
		expect(retry).toHaveBeenCalledOnce()
	})

	it("separates partial data from an incompatible contract", () => {
		const { rerender } = render(
			<DataState
				state={{
					error: { code: "SEQUENCE_GAP", message: "Missing sequence 7" },
					gaps: [7n],
					status: "partial",
				}}
			/>,
		)
		expect(screen.getByText(/data may be incomplete/i)).toBeInTheDocument()

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
		expect(screen.getByText(/contract update detected/i)).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: /continue decoding/i })).not.toBeInTheDocument()
	})

	it("renders page navigation as accessible links", () => {
		render(<Pagination buildHref={(page) => `/submissions?page=${page}`} page={2} totalPages={4} />)

		expect(screen.getByRole("link", { name: /previous page/i })).toHaveAttribute("href", "/submissions?page=1")
		expect(screen.getByRole("link", { name: /next page/i })).toHaveAttribute("href", "/submissions?page=3")
	})

	it("gives copy controls a readable label and has no theme toggle", () => {
		render(
			<div>
				<CopyButton label="Copy transaction hash" value={`0x${"11".repeat(32)}`} />
			</div>,
		)

		expect(screen.getByRole("button", { name: "Copy transaction hash" })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: /theme/i })).not.toBeInTheDocument()
	})
})

import { describe, expect, it, vi } from "vitest"
import { AdaptiveRangeError, type BlockRange, scanAdaptiveRanges } from "./adaptive-ranges"

describe("scanAdaptiveRanges", () => {
	it("doubles the range after two successful requests", async () => {
		const ranges: BlockRange[] = []

		await scanAdaptiveRanges({
			fetchRange: async (range) => {
				ranges.push(range)
				return [range]
			},
			fromBlock: 0n,
			initialSpan: 2n,
			maximumSpan: 8n,
			minimumSpan: 1n,
			toBlock: 11n,
		})

		expect(ranges).toEqual([
			{ fromBlock: 0n, toBlock: 1n },
			{ fromBlock: 2n, toBlock: 3n },
			{ fromBlock: 4n, toBlock: 7n },
			{ fromBlock: 8n, toBlock: 11n },
		])
	})

	it.each([{ code: "RPC_RATE_LIMITED", status: 429 }, { code: "RPC_TIMEOUT" }, { code: "RESPONSE_TOO_LARGE" }])(
		"halves an oversized or unavailable range after $code",
		async (failure) => {
			const ranges: BlockRange[] = []
			let failed = false

			await scanAdaptiveRanges({
				fetchRange: async (range) => {
					ranges.push(range)
					if (!failed) {
						failed = true
						throw Object.assign(new Error(failure.code), failure)
					}
					return [range]
				},
				fromBlock: 0n,
				initialSpan: 8n,
				jitter: () => 0,
				maximumSpan: 8n,
				minimumSpan: 2n,
				sleep: async () => {},
				toBlock: 7n,
			})

			expect(ranges.slice(0, 2)).toEqual([
				{ fromBlock: 0n, toBlock: 7n },
				{ fromBlock: 0n, toBlock: 3n },
			])
		},
	)

	it("reports the exact range after retrying at the minimum span", async () => {
		const delays: number[] = []

		await expect(
			scanAdaptiveRanges({
				baseRetryDelayMs: 100,
				fetchRange: async () => {
					throw Object.assign(new Error("timeout"), { code: "RPC_TIMEOUT" })
				},
				fromBlock: 10n,
				initialSpan: 2n,
				jitter: () => 0,
				maximumRetries: 3,
				maximumSpan: 2n,
				minimumSpan: 2n,
				sleep: async (milliseconds) => {
					delays.push(milliseconds)
				},
				toBlock: 20n,
			}),
		).rejects.toMatchObject({
			code: "RANGE_EXHAUSTED",
			fromBlock: 10n,
			toBlock: 11n,
		})
		expect(delays).toEqual([100, 200])
	})

	it("does not begin a request after cancellation", async () => {
		const controller = new AbortController()
		controller.abort()
		const fetchRange = vi.fn()

		await expect(
			scanAdaptiveRanges({
				fetchRange,
				fromBlock: 0n,
				initialSpan: 2n,
				maximumSpan: 2n,
				minimumSpan: 1n,
				signal: controller.signal,
				toBlock: 2n,
			}),
		).rejects.toBeInstanceOf(AdaptiveRangeError)
		expect(fetchRange).not.toHaveBeenCalled()
	})
})

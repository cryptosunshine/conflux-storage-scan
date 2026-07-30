import { describe, expect, it, vi } from "vitest"
import { CONFLUX_STORAGE_NODE_URLS } from "./config"
import { createStoragePocRuntime, type StoragePocRuntime } from "./runtime"

describe("storage POC runtime", () => {
	it("constructs the live runtime from only the pinned node URLs", () => {
		const clientFactory = vi.fn((url: string) => ({ url }))

		createStoragePocRuntime({
			clientFactory: clientFactory as unknown as NonNullable<
				Parameters<typeof createStoragePocRuntime>[0]["clientFactory"]
			>,
			fixture: false,
		})

		expect(clientFactory.mock.calls.map(([url]) => url)).toEqual([...CONFLUX_STORAGE_NODE_URLS])
	})

	it("never constructs an HTTP client in fixture mode", async () => {
		const clientFactory = vi.fn()

		const runtime: StoragePocRuntime = createStoragePocRuntime({
			clientFactory,
			fixture: true,
		})
		const health = await runtime.inspectNodes(253_160_999n)

		expect(clientFactory).not.toHaveBeenCalled()
		expect(health).toEqual([
			expect.objectContaining({
				healthy: true,
			}),
		])
	})
})

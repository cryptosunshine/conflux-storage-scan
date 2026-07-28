import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { invalidateStorageAfterSync, storageKeys } from "./queries"

describe("analytics query invalidation", () => {
	it("invalidates the cached timeline after a successful storage sync", async () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(storageKeys.analytics(), { asOfDate: "2026-07-28", points: [] })

		await invalidateStorageAfterSync(queryClient)

		expect(queryClient.getQueryState(storageKeys.analytics())?.isInvalidated).toBe(true)
	})
})

import { describe, expect, it } from "vitest"
import { resolveStorageNodeClientUrls, STORAGE_NODE_UPSTREAM_URLS } from "./config"

describe("resolveStorageNodeClientUrls", () => {
	it("returns the configured HTTPS storage node gateway for all deployments", () => {
		expect(resolveStorageNodeClientUrls()).toEqual([...STORAGE_NODE_UPSTREAM_URLS])
	})
})

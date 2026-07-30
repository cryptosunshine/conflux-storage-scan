import { describe, expect, it } from "vitest"
import { resolveStorageNodeClientUrls, STORAGE_NODE_PROXY_ROUTE_PREFIX, STORAGE_NODE_UPSTREAM_URLS } from "./config"

describe("resolveStorageNodeClientUrls", () => {
	it("uses the HTTPS proxy routes when the page is served over HTTPS", () => {
		expect(resolveStorageNodeClientUrls("https:")).toEqual([
			`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/0`,
			`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/1`,
		])
	})

	it("uses the upstream HTTP node URLs for local HTTP development", () => {
		expect(resolveStorageNodeClientUrls("http:")).toEqual([...STORAGE_NODE_UPSTREAM_URLS])
	})
})

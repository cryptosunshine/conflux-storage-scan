import { describe, expect, it } from "vitest"
import { resolveStorageNodeClientUrls, STORAGE_NODE_PROXY_ROUTE_PREFIX, STORAGE_NODE_UPSTREAM_URLS } from "./config"

describe("resolveStorageNodeClientUrls", () => {
	it("uses same-origin proxy routes in the browser to avoid storage gateway CORS", () => {
		expect(resolveStorageNodeClientUrls("https:")).toEqual([`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/0`])
		expect(resolveStorageNodeClientUrls("http:")).toEqual([`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/0`])
	})

	it("keeps upstream URLs for non-browser callers", () => {
		expect(resolveStorageNodeClientUrls("file:")).toEqual([...STORAGE_NODE_UPSTREAM_URLS])
	})
})

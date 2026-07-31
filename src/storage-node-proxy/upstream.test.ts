import { describe, expect, it } from "vitest"
import { STORAGE_NODE_UPSTREAM_URLS } from "../storage/config"
import { describeDirectIpUpstreamBlocker, isDirectIpUrl, parseStorageNodeWorkerUpstreamUrls } from "./upstream"

describe("parseStorageNodeWorkerUpstreamUrls", () => {
	it("falls back to the pinned upstream URLs when the worker env var is unset", () => {
		expect(parseStorageNodeWorkerUpstreamUrls(undefined)).toEqual([...STORAGE_NODE_UPSTREAM_URLS])
	})

	it("parses hostname upstream URLs from the worker env var", () => {
		expect(parseStorageNodeWorkerUpstreamUrls('["https://0gdevnet.confluxrpc.org"]')).toEqual([
			"https://0gdevnet.confluxrpc.org",
		])
	})
})

describe("isDirectIpUrl", () => {
	it("detects direct IP upstream URLs", () => {
		expect(isDirectIpUrl("http://47.84.225.228:5678")).toBe(true)
		expect(isDirectIpUrl("https://0gdevnet.confluxrpc.org")).toBe(false)
	})
})

describe("describeDirectIpUpstreamBlocker", () => {
	it("allows HTTPS hostname upstream URLs", () => {
		expect(describeDirectIpUpstreamBlocker(["https://0gdevnet.confluxrpc.org"])).toBeNull()
	})

	it("blocks direct IP upstream URLs", () => {
		expect(describeDirectIpUpstreamBlocker(["http://47.84.225.228:5678"])).toMatch(/cannot fetch direct IP/i)
	})
})

import { describe, expect, it } from "vitest"
import { STORAGE_NODE_UPSTREAM_URLS } from "../storage/config"
import { describeDirectIpUpstreamBlocker, isDirectIpUrl, parseStorageNodeWorkerUpstreamUrls } from "./upstream"

describe("parseStorageNodeWorkerUpstreamUrls", () => {
	it("falls back to pinned IP URLs when the worker env var is unset", () => {
		expect(parseStorageNodeWorkerUpstreamUrls(undefined)).toEqual([...STORAGE_NODE_UPSTREAM_URLS])
	})

	it("parses hostname upstream URLs from the worker env var", () => {
		expect(
			parseStorageNodeWorkerUpstreamUrls('["http://zgs-node-0.example.com:5678","http://zgs-node-1.example.com:5678"]'),
		).toEqual(["http://zgs-node-0.example.com:5678", "http://zgs-node-1.example.com:5678"])
	})
})

describe("isDirectIpUrl", () => {
	it("detects direct IP upstream URLs", () => {
		expect(isDirectIpUrl("http://47.84.225.228:5678")).toBe(true)
		expect(isDirectIpUrl("http://zgs-node-0.example.com:5678")).toBe(false)
	})
})

describe("describeDirectIpUpstreamBlocker", () => {
	it("explains why Cloudflare cannot use direct IP upstream URLs", () => {
		expect(describeDirectIpUpstreamBlocker(["http://47.84.225.228:5678"])).toMatch(/cannot fetch direct IP/i)
		expect(describeDirectIpUpstreamBlocker(["http://zgs-node-0.example.com:5678"])).toBeNull()
	})
})

import { describe, expect, it } from "vitest"
import { resolveStorageNodeEndpoint, resolveStorageNodeRoute } from "./endpoints"

describe("resolveStorageNodeEndpoint", () => {
	it("maps proxy routes and direct upstream URLs to pinned node metadata", () => {
		expect(resolveStorageNodeEndpoint("/api/storage-node/0")).toEqual({
			hostname: "zgs-node-0.codekb.dev",
			index: 0,
			ip: "47.84.225.228",
		})
		expect(resolveStorageNodeEndpoint("http://47.84.224.253:5678")).toEqual({
			hostname: "zgs-node-1.codekb.dev",
			index: 1,
			ip: "47.84.224.253",
		})
	})
})

describe("resolveStorageNodeRoute", () => {
	it("keeps proxy routes visible on HTTPS pages", () => {
		expect(resolveStorageNodeRoute("/api/storage-node/1", "https:")).toBe("/api/storage-node/1")
	})
})

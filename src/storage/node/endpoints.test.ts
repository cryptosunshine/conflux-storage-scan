import { describe, expect, it } from "vitest"
import { resolveStorageNodeEndpoint, resolveStorageNodeRoute } from "./endpoints"

describe("resolveStorageNodeEndpoint", () => {
	it("maps proxy routes and upstream URLs to display metadata", () => {
		expect(resolveStorageNodeEndpoint("/api/storage-node/0")).toEqual({
			hostname: "0gdevnet.confluxrpc.org",
			index: 0,
			ip: "0gdevnet.confluxrpc.org",
		})
		expect(resolveStorageNodeEndpoint("https://0gdevnet.confluxrpc.org")).toEqual({
			hostname: "0gdevnet.confluxrpc.org",
			index: 0,
			ip: "0gdevnet.confluxrpc.org",
		})
	})
})

describe("resolveStorageNodeRoute", () => {
	it("returns proxy routes for browser deployments", () => {
		expect(resolveStorageNodeRoute("https://0gdevnet.confluxrpc.org", "https:")).toBe("/api/storage-node/0")
		expect(resolveStorageNodeRoute("/api/storage-node/0", "http:")).toBe("/api/storage-node/0")
	})
})

import { describe, expect, it } from "vitest"
import { resolveStorageNodeEndpoint, resolveStorageNodeRoute } from "./endpoints"

describe("resolveStorageNodeEndpoint", () => {
	it("maps the configured storage gateway URL to display metadata", () => {
		expect(resolveStorageNodeEndpoint("https://0gdevnet.confluxrpc.org")).toEqual({
			hostname: "0gdevnet.confluxrpc.org",
			index: 0,
			ip: "0gdevnet.confluxrpc.org",
		})
	})
})

describe("resolveStorageNodeRoute", () => {
	it("returns the client URL unchanged", () => {
		expect(resolveStorageNodeRoute("https://0gdevnet.confluxrpc.org")).toBe("https://0gdevnet.confluxrpc.org")
	})
})

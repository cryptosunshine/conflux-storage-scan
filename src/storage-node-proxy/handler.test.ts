import { describe, expect, it, vi } from "vitest"
import {
	STORAGE_NODE_PROXY_ALLOWED_METHODS,
	STORAGE_NODE_PROXY_ROUTE_PREFIX,
	STORAGE_NODE_UPSTREAM_URLS,
} from "../storage/config"
import { handleStorageNodeProxy } from "./handler"

const config = {
	allowedMethods: STORAGE_NODE_PROXY_ALLOWED_METHODS,
	routePrefix: STORAGE_NODE_PROXY_ROUTE_PREFIX,
	upstreamUrls: STORAGE_NODE_UPSTREAM_URLS,
}

function jsonRpcRequest(method: string, params: unknown[] = []) {
	return new Request(`https://example.test${STORAGE_NODE_PROXY_ROUTE_PREFIX}/0`, {
		body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	})
}

describe("handleStorageNodeProxy", () => {
	it("forwards allowed JSON-RPC calls to the pinned upstream node", async () => {
		const fetch = vi.fn(async () =>
			Response.json({
				id: 1,
				jsonrpc: "2.0",
				result: { connectedPeers: 1 },
			}),
		)

		const response = await handleStorageNodeProxy(jsonRpcRequest("zgs_getStatus"), {
			config,
			fetch,
		})

		expect(fetch).toHaveBeenCalledWith(STORAGE_NODE_UPSTREAM_URLS[0], {
			body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "zgs_getStatus", params: [] }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		})
		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toEqual({
			id: 1,
			jsonrpc: "2.0",
			result: { connectedPeers: 1 },
		})
	})

	it("routes the second node index to the second upstream URL", async () => {
		const fetch = vi.fn(async () => Response.json({ id: 2, jsonrpc: "2.0", result: null }))

		await handleStorageNodeProxy(
			new Request(`https://example.test${STORAGE_NODE_PROXY_ROUTE_PREFIX}/1`, {
				body: JSON.stringify({ id: 2, jsonrpc: "2.0", method: "zgs_getShardConfig", params: [] }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
			{ config, fetch },
		)

		expect(fetch).toHaveBeenCalledWith(STORAGE_NODE_UPSTREAM_URLS[1], expect.objectContaining({ method: "POST" }))
	})

	it("rejects unknown methods and invalid node indexes", async () => {
		const fetch = vi.fn()

		const unknownMethod = await handleStorageNodeProxy(jsonRpcRequest("eth_blockNumber"), {
			config,
			fetch,
		})
		expect(unknownMethod.status).toBe(403)
		expect(fetch).not.toHaveBeenCalled()

		const invalidIndex = await handleStorageNodeProxy(
			new Request(`https://example.test${STORAGE_NODE_PROXY_ROUTE_PREFIX}/9`, {
				body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "zgs_getStatus", params: [] }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
			{ config, fetch },
		)
		expect(invalidIndex.status).toBe(404)
	})

	it("rejects malformed JSON-RPC envelopes", async () => {
		const fetch = vi.fn()

		const response = await handleStorageNodeProxy(
			new Request(`https://example.test${STORAGE_NODE_PROXY_ROUTE_PREFIX}/0`, {
				body: JSON.stringify({ id: 1, method: "zgs_getStatus", params: [] }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			}),
			{ config, fetch },
		)

		expect(response.status).toBe(400)
		expect(fetch).not.toHaveBeenCalled()
	})
})

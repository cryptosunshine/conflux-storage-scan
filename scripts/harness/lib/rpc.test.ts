import { describe, expect, it, vi } from "vitest"
import { createRpcClient } from "./rpc"

describe("strict harness JSON-RPC client", () => {
	it("captures only sanitized request and response bodies", async () => {
		const fetchImplementation = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					id: 1,
					jsonrpc: "2.0",
					result: "0x47",
				}),
				{ status: 200 },
			)
		})
		const client = createRpcClient({
			fetchImplementation,
			url: "https://user:secret@example.invalid/rpc?token=private",
		})

		await expect(client.request("eth_chainId", [])).resolves.toBe("0x47")
		expect(client.captures()).toEqual([
			{
				id: 1,
				method: "eth_chainId",
				params: [],
				result: "0x47",
			},
		])
		expect(JSON.stringify(client.captures())).not.toContain("secret")
		expect(JSON.stringify(client.captures())).not.toContain("private")
	})

	it.each(["eth_sendTransaction", "eth_sendRawTransaction"])("blocks the mutating method %s", async (method) => {
		const fetchImplementation = vi.fn()
		const client = createRpcClient({
			fetchImplementation,
			url: "https://example.invalid",
		})

		await expect(client.request(method, [])).rejects.toMatchObject({
			code: "RPC_METHOD_FORBIDDEN",
		})
		expect(fetchImplementation).not.toHaveBeenCalled()
	})

	it("blocks pricePerSector calldata", async () => {
		const fetchImplementation = vi.fn()
		const client = createRpcClient({
			fetchImplementation,
			url: "https://example.invalid",
		})

		await expect(
			client.request("eth_call", [
				{
					data: "0x61ec5082",
					to: "0x3fF03285AA79027Ecc552432336FCB85eaD7199e",
				},
				"latest",
			]),
		).rejects.toMatchObject({
			code: "RPC_METHOD_FORBIDDEN",
		})
		expect(fetchImplementation).not.toHaveBeenCalled()
	})
})

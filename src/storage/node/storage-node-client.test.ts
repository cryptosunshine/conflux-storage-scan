import { describe, expect, it, vi } from "vitest"
import type { StorageSegmentWithProof } from "../types"
import { HttpStorageNodeClient, StorageNodeRpcError } from "./storage-node-client"

const nodeUrl = "http://47.84.224.253:5678"

function jsonRpcResponse(result: unknown): Response {
	return Response.json({ id: 1, jsonrpc: "2.0", result })
}

describe("HttpStorageNodeClient", () => {
	it("preserves the browser receiver when using the default fetch", async () => {
		const originalFetch = globalThis.fetch
		const browserFetch: typeof globalThis.fetch = function browserFetch(this: typeof globalThis) {
			if (this !== globalThis) {
				throw new TypeError("Illegal invocation")
			}
			return Promise.resolve(jsonRpcResponse({ numShard: 1, shardId: 0 }))
		}
		vi.stubGlobal("fetch", browserFetch)

		try {
			const client = new HttpStorageNodeClient(nodeUrl)

			await expect(client.getShardConfig()).resolves.toEqual({
				numShard: 1,
				shardId: 0,
			})
		} finally {
			vi.stubGlobal("fetch", originalFetch)
		}
	})

	it("sends zgs_getFileInfoByTxSeq with a safe numeric sequence", async () => {
		const requests: unknown[] = []
		const client = new HttpStorageNodeClient(nodeUrl, {
			fetch: async (_input, init) => {
				requests.push(JSON.parse(String(init?.body)))
				return jsonRpcResponse(null)
			},
		})

		await client.getFileInfoByTxSeq(485)

		expect(requests).toEqual([
			{
				id: 1,
				jsonrpc: "2.0",
				method: "zgs_getFileInfoByTxSeq",
				params: [485],
			},
		])
	})

	it("normalizes status quantities and the network identity", async () => {
		const client = new HttpStorageNodeClient(nodeUrl, {
			fetch: async () =>
				jsonRpcResponse({
					connectedPeers: 1,
					logSyncBlock: `0x${"11".repeat(32)}`,
					logSyncHeight: 258_467_864,
					networkIdentity: {
						chainId: 71,
						flowAddress: "0x3ff03285aa79027ecc552432336fcb85ead7199e",
						p2pProtocolVersion: { build: 0, major: 0, minor: 4 },
					},
					nextTxSeq: 486,
				}),
		})

		await expect(client.getStatus()).resolves.toEqual({
			connectedPeers: 1,
			logSyncBlock: `0x${"11".repeat(32)}`,
			logSyncHeight: 258_467_864n,
			networkIdentity: {
				chainId: 71,
				flowAddress: "0x3fF03285AA79027Ecc552432336FCB85eaD7199e",
				p2pProtocolVersion: { build: 0, major: 0, minor: 4 },
			},
			nextTxSeq: 486,
		})
	})

	it("validates and normalizes FileInfo", async () => {
		const client = new HttpStorageNodeClient(nodeUrl, {
			fetch: async () =>
				jsonRpcResponse({
					finalized: false,
					isCached: false,
					pruned: false,
					tx: {
						data: [],
						dataMerkleRoot: `0x${"22".repeat(32)}`,
						merkleNodes: [],
						seq: 485,
						size: 42,
						startEntryIndex: 290_624,
						streamIds: [],
					},
					uploadedSegNum: 0,
				}),
		})

		await expect(client.getFileInfoByTxSeq(485)).resolves.toEqual({
			finalized: false,
			isCached: false,
			pruned: false,
			tx: {
				dataMerkleRoot: `0x${"22".repeat(32)}`,
				seq: 485,
				size: 42,
				startEntryIndex: 290_624n,
			},
			uploadedSegNum: 0,
		})
	})

	it("uses the exact upload and download RPC methods", async () => {
		const bodies: Array<{ method: string; params: unknown[] }> = []
		const client = new HttpStorageNodeClient(nodeUrl, {
			fetch: async (_input, init) => {
				const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] }
				bodies.push(body)
				return Response.json({
					id: bodies.length,
					jsonrpc: "2.0",
					result: body.method === "zgs_downloadSegmentByTxSeq" ? "c3RvcmFnZQ==" : 0,
				})
			},
		})
		const segment: StorageSegmentWithProof = {
			data: "c3RvcmFnZQ==",
			fileSize: 7,
			index: 0,
			proof: {
				lemma: [`0x${"33".repeat(32)}`],
				path: [],
			},
			root: `0x${"33".repeat(32)}`,
		}

		await expect(client.uploadSegmentsByTxSeq([segment], 485)).resolves.toBe(0)
		await expect(client.downloadSegmentByTxSeq(485, 0, 1)).resolves.toBe("c3RvcmFnZQ==")

		expect(bodies).toEqual([
			expect.objectContaining({
				method: "zgs_uploadSegmentsByTxSeq",
				params: [[segment], 485],
			}),
			expect.objectContaining({
				method: "zgs_downloadSegmentByTxSeq",
				params: [485, 0, 1],
			}),
		])
	})

	it("rejects unsafe numeric RPC parameters before network access", async () => {
		const fetch = vi.fn<typeof globalThis.fetch>()
		const client = new HttpStorageNodeClient(nodeUrl, { fetch })

		await expect(client.getFileInfoByTxSeq(Number.MAX_SAFE_INTEGER + 1)).rejects.toMatchObject({
			code: "INVALID_ARGUMENT",
		})
		expect(fetch).not.toHaveBeenCalled()
	})

	it("maps JSON-RPC failures to typed errors without retaining response data", async () => {
		const client = new HttpStorageNodeClient(nodeUrl, {
			fetch: async () =>
				Response.json({
					error: {
						code: -32_000,
						data: { authorization: "secret" },
						message: "temporary storage failure",
					},
					id: 1,
					jsonrpc: "2.0",
				}),
		})

		const error = await client.getShardConfig().catch((cause: unknown) => cause)

		expect(error).toBeInstanceOf(StorageNodeRpcError)
		expect(error).toMatchObject({
			code: "RPC_ERROR",
			message: "Storage Node RPC zgs_getShardConfig failed (-32000): temporary storage failure",
		})
		expect(JSON.stringify(error)).not.toContain("secret")
	})

	it("rejects malformed status responses", async () => {
		const client = new HttpStorageNodeClient(nodeUrl, {
			fetch: async () =>
				jsonRpcResponse({
					connectedPeers: 1,
					logSyncHeight: -1,
					networkIdentity: {
						chainId: 71,
						flowAddress: "not-an-address",
					},
					nextTxSeq: 486,
				}),
		})

		await expect(client.getStatus()).rejects.toMatchObject({
			code: "MALFORMED_RESPONSE",
		})
	})
})

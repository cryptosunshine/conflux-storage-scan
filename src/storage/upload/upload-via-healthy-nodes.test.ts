import { describe, expect, it, vi } from "vitest"
import type { HealthyStorageNode } from "../node/node-pool"
import { StoragePocError } from "../types"
import { uploadViaHealthyNodes } from "./upload-via-healthy-nodes"

function healthyNode(url: string): HealthyStorageNode {
	return {
		blockLag: 1n,
		client: { url } as HealthyStorageNode["client"],
		healthy: true,
		latencyMs: 10,
		shard: { numShard: 1, shardId: 0 },
		status: {
			connectedPeers: 1,
			logSyncBlock: `0x${"11".repeat(32)}`,
			logSyncHeight: 100n,
			networkIdentity: {
				chainId: 71,
				flowAddress: "0x3fF03285AA79027Ecc552432336FCB85eaD7199e",
				p2pProtocolVersion: { build: 0, major: 0, minor: 4 },
			},
			nextTxSeq: 491,
		},
	}
}

describe("uploadViaHealthyNodes", () => {
	it("skips a failing node and uploads through the next healthy node", async () => {
		const laggingNode = healthyNode("http://47.84.225.228:5678")
		const healthy = healthyNode("http://47.84.224.253:5678")
		const waitForFile = vi.fn().mockResolvedValue(undefined)
		const upload = vi
			.fn()
			.mockRejectedValueOnce(new StoragePocError("UPLOAD_FAILED", "Storage Node rejected Segment 0"))
			.mockResolvedValueOnce(undefined)

		const selected = await uploadViaHealthyNodes({
			nodes: [laggingNode, healthy],
			prepared: {
				root: `0x${"22".repeat(32)}`,
				source: new File([Uint8Array.of(1)], "a.bin"),
			} as never,
			txSeq: 490,
			upload,
			waitForFile,
		})

		expect(selected.client.url).toBe("http://47.84.224.253:5678")
		expect(waitForFile).toHaveBeenCalledTimes(2)
		expect(upload).toHaveBeenCalledTimes(2)
		expect(upload.mock.calls[1]?.[0].client.url).toBe("http://47.84.224.253:5678")
	})

	it("does not fail over for integrity errors", async () => {
		const waitForFile = vi.fn().mockRejectedValue(new StoragePocError("FILE_INFO_MISMATCH", "mismatch"))
		const upload = vi.fn()

		await expect(
			uploadViaHealthyNodes({
				nodes: [healthyNode("http://47.84.225.228:5678"), healthyNode("http://47.84.224.253:5678")],
				prepared: {
					root: `0x${"22".repeat(32)}`,
					source: new File([Uint8Array.of(1)], "a.bin"),
				} as never,
				txSeq: 490,
				upload,
				waitForFile,
			}),
		).rejects.toMatchObject({ code: "FILE_INFO_MISMATCH" })
		expect(upload).not.toHaveBeenCalled()
	})
})

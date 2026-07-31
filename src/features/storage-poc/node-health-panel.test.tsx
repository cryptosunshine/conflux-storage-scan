import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { StorageNodeHealth } from "../../storage/node/node-pool"
import { NodeHealthPanel } from "./node-health-panel"

function health(url: string, healthy: boolean): StorageNodeHealth {
	return {
		blockLag: healthy ? 3n : 173830n,
		client: { url } as StorageNodeHealth["client"],
		healthy,
		latencyMs: 12,
		...(healthy
			? {
					reason: undefined,
					shard: { numShard: 1, shardId: 0 },
					status: {
						connectedPeers: 1,
						logSyncBlock: "0x00",
						logSyncHeight: 100n,
						networkIdentity: {
							chainId: 71,
							flowAddress: "0x3fF03285AA79027Ecc552432336FCB85eaD7199e",
							p2pProtocolVersion: { build: 0, major: 0, minor: 4 },
						},
						nextTxSeq: 485,
					},
				}
			: { reason: "lagging" as const }),
	}
}

describe("NodeHealthPanel", () => {
	it("shows node index, hostname, and same-origin proxy route", () => {
		render(<NodeHealthPanel checking={false} health={[health("/api/storage-node/0", true)]} onCheck={vi.fn()} />)

		expect(screen.getByText("Node 0 · 0gdevnet.confluxrpc.org")).toBeInTheDocument()
		expect(screen.getByText("/api/storage-node/0")).toBeInTheDocument()
		expect(screen.getByText("Available")).toBeInTheDocument()
	})
})

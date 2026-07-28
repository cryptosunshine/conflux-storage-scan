import { describe, expect, it } from "vitest"
import {
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../../src/chain/config"
import type { StorageSubmission } from "../../src/chain/types"
import { buildFixturePayload } from "./capture"
import type { RpcCapture } from "./lib/rpc"
import type { ProbeResult } from "./probe"

const submission: StorageSubmission = {
	canonicalKey: `71:${FIXED_PRICE_FLOW_PROXY.toLowerCase()}:0x${"22".repeat(32)}:0x${"33".repeat(32)}:0`,
	chainId: 71,
	contractAddress: FIXED_PRICE_FLOW_PROXY,
	implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
	sequence: 0n,
	submitter: "0x1111111111111111111111111111111111111111",
	submissionIdentity: `0x${"44".repeat(32)}`,
	logicalSizeBytes: 1_234n,
	startSector: 100n,
	sectorCount: 9n,
	endSectorExclusive: 109n,
	nodeRoots: [`0x${"55".repeat(32)}`],
	tags: "0x1234",
	blockNumber: 253_160_871n,
	blockHash: `0x${"22".repeat(32)}`,
	transactionHash: `0x${"33".repeat(32)}`,
	transactionIndex: 0,
	logIndex: 0,
	transactionLogIndex: 0,
	timestamp: 1_700_000_000,
}

const probe: ProbeResult = {
	identity: {
		chainId: 71,
		proxy: FIXED_PRICE_FLOW_PROXY,
		beacon: FIXED_PRICE_FLOW_BEACON,
		implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
		market: FIXED_PRICE_FLOW_MARKET,
	},
	headBlock: {
		number: 253_160_900n,
		hash: `0x${"66".repeat(32)}`,
		timestamp: 1_700_000_010n,
	},
	state: {
		paused: false,
		submissionIndex: 1n,
		currentLength: 9n,
		unstagedHeight: 20n,
	},
	rawLogs: [
		{
			blockTimestamp: "0x6553f100",
			transactionLogIndex: "0x0",
		},
	],
	submissions: [submission],
	featureFlags: {
		blockTimestamp: true,
		transactionLogIndex: true,
	},
}

const captures: readonly RpcCapture[] = [
	{
		id: 1,
		method: "eth_chainId",
		params: [],
		result: "0x47",
	},
]

describe("fixture capture payload", () => {
	it("serializes bigint values as decimal strings without endpoint details", () => {
		const payload = buildFixturePayload({
			abiSha256: "a".repeat(64),
			capturedAt: "2026-07-28T00:00:00.000Z",
			captures,
			probe,
		})
		const submissions = JSON.parse(payload.files["expected/submissions.json"] ?? "null")
		const manifest = JSON.parse(payload.files["manifest.json"] ?? "null")

		expect(submissions[0]).toMatchObject({
			logicalSizeBytes: "1234",
			sequence: "0",
			sectorCount: "9",
		})
		expect(manifest.expectedSubmissions).toBe(1)
		expect(JSON.stringify(payload)).not.toContain("rpcUrl")
		expect(JSON.stringify(payload)).not.toContain("pricePerSector")
	})
})

import { encodeAbiParameters, encodeEventTopics, encodeFunctionResult, type Hex, parseAbiParameters, toHex } from "viem"
import { describe, expect, it, vi } from "vitest"
import { beaconAbi } from "../../src/chain/abi/beacon"
import { fixedPriceFlowAbi } from "../../src/chain/abi/fixed-price-flow"
import {
	EIP1967_BEACON_SLOT,
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../../src/chain/config"
import { calculateSubmissionIdentity } from "../../src/chain/normalize/submission-identity"
import type { HarnessRpcClient } from "./lib/rpc"
import { formatProbeSummary, runProbe } from "./probe"

const submitter = "0x1111111111111111111111111111111111111111" as const
const nodeRoot = `0x${"11".repeat(32)}` as const
const identity = calculateSubmissionIdentity([nodeRoot])
const headBlock = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 10n

function encodedResult(functionName: "implementation" | "market" | "paused" | "submissionIndex" | "tree"): Hex {
	switch (functionName) {
		case "implementation":
			return encodeFunctionResult({
				abi: beaconAbi,
				functionName,
				result: FIXED_PRICE_FLOW_IMPLEMENTATION,
			})
		case "market":
			return encodeFunctionResult({
				abi: fixedPriceFlowAbi,
				functionName,
				result: FIXED_PRICE_FLOW_MARKET,
			})
		case "paused":
			return encodeFunctionResult({
				abi: fixedPriceFlowAbi,
				functionName,
				result: false,
			})
		case "submissionIndex":
			return encodeFunctionResult({
				abi: fixedPriceFlowAbi,
				functionName,
				result: 1n,
			})
		case "tree":
			return encodeFunctionResult({
				abi: fixedPriceFlowAbi,
				functionName,
				result: [9n, 20n],
			})
	}
}

function rawSubmitLog() {
	const topics = encodeEventTopics({
		abi: fixedPriceFlowAbi,
		args: {
			identity,
			sender: submitter,
		},
		eventName: "Submit",
	})
	const data = encodeAbiParameters(parseAbiParameters("uint256,uint256,uint256,(uint256,bytes,(bytes32,uint256)[])"), [
		0n,
		100n,
		9n,
		[1_234n, "0x1234", [[nodeRoot, 3n]]],
	])

	return {
		address: FIXED_PRICE_FLOW_PROXY,
		blockHash: `0x${"22".repeat(32)}`,
		blockNumber: toHex(FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 1n),
		blockTimestamp: toHex(1_700_000_000),
		data,
		logIndex: "0x0",
		removed: false,
		topics,
		transactionHash: `0x${"33".repeat(32)}`,
		transactionIndex: "0x0",
		transactionLogIndex: "0x0",
	}
}

function createFakeClient(): HarnessRpcClient {
	const request = vi.fn(async (method: string, params: readonly unknown[] = []) => {
		switch (method) {
			case "eth_chainId":
				return "0x47"
			case "eth_blockNumber":
				return toHex(headBlock)
			case "eth_getBlockByNumber":
				return {
					hash: `0x${"44".repeat(32)}`,
					number: toHex(headBlock),
					timestamp: toHex(1_700_000_010),
				}
			case "eth_getCode":
				return "0x6000"
			case "eth_getStorageAt":
				expect(params).toEqual([FIXED_PRICE_FLOW_PROXY, EIP1967_BEACON_SLOT, toHex(headBlock)])
				return `0x${"0".repeat(24)}${FIXED_PRICE_FLOW_BEACON.slice(2).toLowerCase()}`
			case "eth_call": {
				const call = params[0] as { data: Hex; to: string }
				if (call.to.toLowerCase() === FIXED_PRICE_FLOW_BEACON.toLowerCase()) {
					return encodedResult("implementation")
				}
				const selector = call.data.slice(0, 10)
				const selectors = {
					"0x5c975abb": "paused",
					"0x80f55605": "market",
					"0xb8a409ac": "submissionIndex",
					"0xfd54b228": "tree",
				} as const
				const name = selectors[selector as keyof typeof selectors]
				if (!name) {
					throw new Error(`Unexpected call selector ${selector}`)
				}
				return encodedResult(name)
			}
			case "eth_getLogs":
				return [rawSubmitLog()]
			default:
				throw new Error(`Unexpected method ${method}`)
		}
	})

	return {
		captures: () => [],
		request: request as HarnessRpcClient["request"],
	}
}

describe("live probe orchestration", () => {
	it("verifies the deployment and normalizes Submit logs at a fixed head", async () => {
		const result = await runProbe(createFakeClient(), { logBlockSpan: 100n })

		expect(result.identity).toMatchObject({
			beacon: FIXED_PRICE_FLOW_BEACON,
			implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
			market: FIXED_PRICE_FLOW_MARKET,
			proxy: FIXED_PRICE_FLOW_PROXY,
		})
		expect(result.submissions).toHaveLength(1)
		expect(result.submissions[0]).toMatchObject({
			logicalSizeBytes: 1_234n,
			sectorCount: 9n,
			submitter,
		})
		expect(formatProbeSummary(result)).toBe(
			"chain=71 proxy=ok beacon=ok implementation=ok market=ok submissions=1 logs=1 paused=false",
		)
	})
})

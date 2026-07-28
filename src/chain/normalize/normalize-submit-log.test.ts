import type { Hex } from "viem"
import { describe, expect, it } from "vitest"
import { FIXED_PRICE_FLOW_IMPLEMENTATION, FIXED_PRICE_FLOW_PROXY } from "../config"
import { normalizeSubmitLog } from "./normalize-submit-log"

const submitter = "0x1111111111111111111111111111111111111111" as const
const nodeRoot = `0x${"11".repeat(32)}` as const
const submissionIdentity: Hex = "0xb569321de72d0af89c2fb48a484de3fc9343f31600ae1f3e13d633cb48cbf816"
const blockHash = `0x${"22".repeat(32)}` as const
const transactionHash = `0x${"33".repeat(32)}` as const

function makeLog(logIndex = 4) {
	return {
		address: FIXED_PRICE_FLOW_PROXY,
		args: {
			identity: submissionIdentity,
			length: 9n,
			sender: submitter,
			startPos: 100n,
			submission: {
				length: 1_234n,
				nodes: [{ height: 3n, root: nodeRoot }],
				tags: "0x1234" as const,
			},
			submissionIndex: 7n,
		},
		blockHash,
		blockNumber: 253_160_900n,
		blockTimestamp: "0x6553f100" as const,
		logIndex,
		transactionHash,
		transactionIndex: 2,
		transactionLogIndex: 1,
	}
}

describe("normalizeSubmitLog", () => {
	it("maps the contract's submitter, byte length, and sector boundaries", () => {
		const submission = normalizeSubmitLog(makeLog(), {
			implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		})

		expect(submission).toMatchObject({
			sequence: 7n,
			submitter,
			logicalSizeBytes: 1_234n,
			startSector: 100n,
			sectorCount: 9n,
			endSectorExclusive: 109n,
			submissionIdentity,
			nodeRoots: [nodeRoot],
			tags: "0x1234",
			timestamp: 1_700_000_000,
		})
	})

	it("keeps different logs from one transaction as separate canonical records", () => {
		const options = { implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION }

		expect(normalizeSubmitLog(makeLog(4), options).canonicalKey).not.toBe(
			normalizeSubmitLog(makeLog(5), options).canonicalKey,
		)
	})

	it("rejects an event identity that does not match the packed node roots", () => {
		const log = makeLog()
		log.args.identity = `0x${"ff".repeat(32)}`

		expect(() =>
			normalizeSubmitLog(log, {
				implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
			}),
		).toThrow(
			expect.objectContaining({
				code: "IDENTITY_MISMATCH",
			}),
		)
	})

	it("requires a caller-supplied timestamp when the provider omits blockTimestamp", () => {
		const { blockTimestamp: _, ...standardLog } = makeLog()

		expect(() =>
			normalizeSubmitLog(standardLog, {
				implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
			}),
		).toThrow(
			expect.objectContaining({
				code: "TIMESTAMP_MISSING",
			}),
		)

		expect(
			normalizeSubmitLog(standardLog, {
				blockTimestamp: 1_700_000_001n,
				implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
			}).timestamp,
		).toBe(1_700_000_001)
	})
})

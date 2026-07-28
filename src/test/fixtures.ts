import { FIXED_PRICE_FLOW_IMPLEMENTATION, FIXED_PRICE_FLOW_PROXY } from "../chain/config"
import type { StorageSubmission } from "../chain/types"

const DEFAULT_SUBMITTER = "0x1111111111111111111111111111111111111111" as const

function hash(value: number): `0x${string}` {
	return `0x${value.toString(16).padStart(2, "0").repeat(32)}`
}

export function createSubmissionFixture(
	sequence: bigint,
	overrides: Partial<StorageSubmission> = {},
): StorageSubmission {
	const numericSequence = Number(sequence)
	const blockHash = hash(numericSequence + 1)
	const transactionHash = hash(numericSequence + 101)
	const nodeRoot = hash(numericSequence + 201)
	return {
		blockHash,
		blockNumber: 253_160_871n + sequence,
		canonicalKey: `71:${FIXED_PRICE_FLOW_PROXY.toLowerCase()}:${blockHash}:${transactionHash}:0`,
		chainId: 71,
		contractAddress: FIXED_PRICE_FLOW_PROXY,
		endSectorExclusive: sequence + 12n,
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		logIndex: 0,
		logicalSizeBytes: 2_048n + sequence,
		nodeRoots: [nodeRoot],
		sectorCount: 12n,
		sequence,
		startSector: sequence,
		submissionIdentity: nodeRoot,
		submitter: DEFAULT_SUBMITTER,
		tags: "0x",
		timestamp: 1_720_000_000 + numericSequence,
		transactionHash,
		transactionIndex: 0,
		...overrides,
	}
}

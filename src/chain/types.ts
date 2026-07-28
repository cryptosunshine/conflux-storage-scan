import type { Address, Hex } from "viem"
import type { CONFLUX_ESPACE_TESTNET_CHAIN_ID } from "./config"

export interface StorageSubmission {
	readonly canonicalKey: string
	readonly chainId: typeof CONFLUX_ESPACE_TESTNET_CHAIN_ID
	readonly contractAddress: Address
	readonly implementationAddress: Address
	readonly sequence: bigint
	readonly submitter: Address
	readonly submissionIdentity: Hex
	readonly logicalSizeBytes: bigint
	readonly startSector: bigint
	readonly sectorCount: bigint
	readonly endSectorExclusive: bigint
	readonly nodeRoots: readonly Hex[]
	readonly tags: Hex
	readonly blockNumber: bigint
	readonly blockHash: Hex
	readonly transactionHash: Hex
	readonly transactionIndex: number
	readonly logIndex: number
	readonly transactionLogIndex?: number
	readonly timestamp: number
}

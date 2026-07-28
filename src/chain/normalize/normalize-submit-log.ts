import { type Address, getAddress, type Hex, isAddress, isHex, size } from "viem"
import { CONFLUX_ESPACE_TESTNET_CHAIN_ID } from "../config"
import type { StorageSubmission } from "../types"
import { calculateSubmissionIdentity } from "./submission-identity"

export type NormalizeSubmitLogErrorCode =
	| "FIELD_MISSING"
	| "FIELD_INVALID"
	| "IDENTITY_MISMATCH"
	| "TIMESTAMP_MISSING"
	| "TIMESTAMP_INVALID"

export class NormalizeSubmitLogError extends Error {
	readonly code: NormalizeSubmitLogErrorCode

	constructor(code: NormalizeSubmitLogErrorCode, message: string) {
		super(message)
		this.name = "NormalizeSubmitLogError"
		this.code = code
	}
}

export interface SubmitNodeInput {
	readonly root?: Hex
	readonly height?: bigint
}

export interface SubmitLogInput {
	readonly address?: Address
	readonly args?: {
		readonly sender?: Address
		readonly identity?: Hex
		readonly submissionIndex?: bigint
		readonly startPos?: bigint
		readonly length?: bigint
		readonly submission?: {
			readonly length?: bigint
			readonly tags?: Hex
			readonly nodes?: readonly SubmitNodeInput[]
		}
	}
	readonly blockNumber?: bigint | null
	readonly blockHash?: Hex | null
	readonly transactionHash?: Hex | null
	readonly transactionIndex?: number | null
	readonly logIndex?: number | null
	readonly transactionLogIndex?: number | null
	readonly blockTimestamp?: bigint | number | Hex
}

export interface NormalizeSubmitLogOptions {
	readonly implementationAddress: Address
	readonly blockTimestamp?: bigint | number | Hex
}

function requireBigInt(value: bigint | undefined | null, label: string): bigint {
	if (typeof value !== "bigint" || value < 0n) {
		throw new NormalizeSubmitLogError("FIELD_INVALID", `${label} must be a non-negative bigint`)
	}
	return value
}

function requireIndex(value: number | undefined | null, label: string): number {
	if (!Number.isSafeInteger(value) || (value ?? -1) < 0) {
		throw new NormalizeSubmitLogError("FIELD_INVALID", `${label} must be a non-negative safe integer`)
	}
	return value as number
}

function requireAddress(value: Address | undefined, label: string): Address {
	if (!value || !isAddress(value)) {
		throw new NormalizeSubmitLogError("FIELD_INVALID", `${label} must be a valid EVM address`)
	}
	return getAddress(value)
}

function requireHex(value: Hex | undefined | null, bytes: number | undefined, label: string): Hex {
	if (!value || !isHex(value, { strict: true }) || (bytes !== undefined && size(value) !== bytes)) {
		throw new NormalizeSubmitLogError(
			"FIELD_INVALID",
			`${label} must be ${bytes === undefined ? "hexadecimal bytes" : `${bytes} bytes`}`,
		)
	}
	return value
}

function parseTimestamp(value: bigint | number | Hex | undefined): number {
	if (value === undefined) {
		throw new NormalizeSubmitLogError(
			"TIMESTAMP_MISSING",
			"blockTimestamp is absent; fetch the timestamp by block hash and provide it to the normalizer",
		)
	}

	let timestamp: bigint
	try {
		timestamp = typeof value === "bigint" ? value : BigInt(value)
	} catch {
		throw new NormalizeSubmitLogError("TIMESTAMP_INVALID", "blockTimestamp must be an integer or hex quantity")
	}

	if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new NormalizeSubmitLogError("TIMESTAMP_INVALID", "blockTimestamp is outside the safe integer range")
	}

	return Number(timestamp)
}

export function normalizeSubmitLog(log: SubmitLogInput, options: NormalizeSubmitLogOptions): StorageSubmission {
	const args = log.args
	const submission = args?.submission
	if (!args || !submission?.nodes) {
		throw new NormalizeSubmitLogError("FIELD_MISSING", "Decoded Submit event arguments are incomplete")
	}

	const contractAddress = requireAddress(log.address, "log.address")
	const implementationAddress = requireAddress(options.implementationAddress, "implementationAddress")
	const submitter = requireAddress(args.sender, "args.sender")
	const eventIdentity = requireHex(args.identity, 32, "args.identity")
	const nodeRoots = submission.nodes.map((node, index) =>
		requireHex(node.root, 32, `args.submission.nodes[${index}].root`),
	)
	const calculatedIdentity = calculateSubmissionIdentity(nodeRoots)
	if (calculatedIdentity.toLowerCase() !== eventIdentity.toLowerCase()) {
		throw new NormalizeSubmitLogError(
			"IDENTITY_MISMATCH",
			`Submit identity ${eventIdentity} does not match node roots digest ${calculatedIdentity}`,
		)
	}

	const sequence = requireBigInt(args.submissionIndex, "args.submissionIndex")
	const logicalSizeBytes = requireBigInt(submission.length, "args.submission.length")
	const startSector = requireBigInt(args.startPos, "args.startPos")
	const sectorCount = requireBigInt(args.length, "args.length")
	const blockNumber = requireBigInt(log.blockNumber, "log.blockNumber")
	const blockHash = requireHex(log.blockHash, 32, "log.blockHash")
	const transactionHash = requireHex(log.transactionHash, 32, "log.transactionHash")
	const transactionIndex = requireIndex(log.transactionIndex, "log.transactionIndex")
	const logIndex = requireIndex(log.logIndex, "log.logIndex")
	const transactionLogIndex =
		log.transactionLogIndex === undefined || log.transactionLogIndex === null
			? undefined
			: requireIndex(log.transactionLogIndex, "log.transactionLogIndex")
	const timestamp = parseTimestamp(log.blockTimestamp ?? options.blockTimestamp)

	return {
		canonicalKey: [
			CONFLUX_ESPACE_TESTNET_CHAIN_ID,
			contractAddress.toLowerCase(),
			blockHash.toLowerCase(),
			transactionHash.toLowerCase(),
			logIndex,
		].join(":"),
		chainId: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
		contractAddress,
		implementationAddress,
		sequence,
		submitter,
		submissionIdentity: eventIdentity,
		logicalSizeBytes,
		startSector,
		sectorCount,
		endSectorExclusive: startSector + sectorCount,
		nodeRoots,
		tags: requireHex(submission.tags, undefined, "args.submission.tags"),
		blockNumber,
		blockHash,
		transactionHash,
		transactionIndex,
		logIndex,
		...(transactionLogIndex === undefined ? {} : { transactionLogIndex }),
		timestamp,
	}
}

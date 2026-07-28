import { pathToFileURL } from "node:url"
import {
	type Address,
	decodeEventLog,
	decodeFunctionResult,
	encodeEventTopics,
	encodeFunctionData,
	getAddress,
	type Hex,
	isAddress,
	isAddressEqual,
	isHex,
	size,
	toHex,
} from "viem"
import { beaconAbi } from "../../src/chain/abi/beacon"
import { fixedPriceFlowAbi } from "../../src/chain/abi/fixed-price-flow"
import {
	CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	EIP1967_BEACON_SLOT,
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../../src/chain/config"
import { normalizeSubmitLog, type SubmitLogInput } from "../../src/chain/normalize/normalize-submit-log"
import type { StorageSubmission } from "../../src/chain/types"
import { createRpcClient, type HarnessRpcClient, RpcClientError } from "./lib/rpc"

const DEFAULT_LOG_BLOCK_SPAN = 500_000n
const MINIMUM_RETRY_LOG_BLOCK_SPAN = 1_000n

export type ProbeErrorCode =
	| "CHAIN_ID_MISMATCH"
	| "HEAD_BLOCK_INVALID"
	| "PROXY_CODE_MISSING"
	| "BEACON_MISMATCH"
	| "BEACON_CODE_MISSING"
	| "IMPLEMENTATION_MISMATCH"
	| "MARKET_MISMATCH"
	| "RPC_DATA_INVALID"
	| "REMOVED_LOG"

export class ProbeError extends Error {
	readonly code: ProbeErrorCode

	constructor(code: ProbeErrorCode, message: string) {
		super(message)
		this.name = "ProbeError"
		this.code = code
	}
}

interface RpcBlock {
	readonly number?: Hex | null
	readonly hash?: Hex | null
	readonly timestamp?: Hex
}

interface RpcLog {
	readonly address?: Address
	readonly blockHash?: Hex | null
	readonly blockNumber?: Hex | null
	readonly blockTimestamp?: Hex
	readonly data?: Hex
	readonly logIndex?: Hex | null
	readonly removed?: boolean
	readonly topics?: readonly Hex[]
	readonly transactionHash?: Hex | null
	readonly transactionIndex?: Hex | null
	readonly transactionLogIndex?: Hex | null
}

export interface ProbeOptions {
	readonly logBlockSpan?: bigint
}

export interface ProbeResult {
	readonly identity: {
		readonly chainId: typeof CONFLUX_ESPACE_TESTNET_CHAIN_ID
		readonly proxy: Address
		readonly beacon: Address
		readonly implementation: Address
		readonly market: Address
	}
	readonly headBlock: {
		readonly number: bigint
		readonly hash: Hex
		readonly timestamp: bigint
	}
	readonly state: {
		readonly paused: boolean
		readonly submissionIndex: bigint
		readonly currentLength: bigint
		readonly unstagedHeight: bigint
	}
	readonly rawLogs: readonly RpcLog[]
	readonly submissions: readonly StorageSubmission[]
	readonly featureFlags: {
		readonly blockTimestamp: boolean
		readonly transactionLogIndex: boolean
	}
}

function parseQuantity(value: unknown, label: string): bigint {
	if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) {
		throw new ProbeError("RPC_DATA_INVALID", `${label} is not a canonical hex quantity`)
	}
	return BigInt(value)
}

function parseSafeIndex(value: unknown, label: string): number {
	const quantity = parseQuantity(value, label)
	if (quantity > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new ProbeError("RPC_DATA_INVALID", `${label} exceeds the safe integer range`)
	}
	return Number(quantity)
}

function requireHex(value: unknown, bytes: number, label: string): Hex {
	if (typeof value !== "string" || !isHex(value, { strict: true }) || size(value) !== bytes) {
		throw new ProbeError("RPC_DATA_INVALID", `${label} must be ${bytes} bytes`)
	}
	return value
}

function requireAddress(value: unknown, label: string): Address {
	if (typeof value !== "string" || !isAddress(value)) {
		throw new ProbeError("RPC_DATA_INVALID", `${label} is not an EVM address`)
	}
	return getAddress(value)
}

function requireCode(value: unknown, code: ProbeErrorCode, label: string): void {
	if (typeof value !== "string" || !isHex(value, { strict: true }) || value === "0x") {
		throw new ProbeError(code, `${label} has no deployed bytecode`)
	}
}

function requireExpectedAddress(value: Address, expected: Address, code: ProbeErrorCode, label: string): void {
	if (!isAddressEqual(value, expected)) {
		throw new ProbeError(code, `${label} is ${value}; expected ${expected}`)
	}
}

function beaconFromStorage(value: unknown): Address {
	const storage = requireHex(value, 32, "EIP-1967 beacon slot")
	return requireAddress(`0x${storage.slice(-40)}`, "EIP-1967 beacon")
}

async function readFunction<Abi extends typeof beaconAbi | typeof fixedPriceFlowAbi, FunctionName extends string>(
	client: HarnessRpcClient,
	address: Address,
	blockTag: Hex,
	abi: Abi,
	functionName: FunctionName,
): Promise<unknown> {
	const data = encodeFunctionData({
		abi,
		functionName,
	} as never)
	const result = await client.request<Hex>("eth_call", [{ data, to: address }, blockTag])
	return decodeFunctionResult({
		abi,
		data: result,
		functionName,
	} as never)
}

function shouldSplitLogRange(error: unknown): boolean {
	return error instanceof RpcClientError && ["RPC_HTTP_ERROR", "RPC_RESPONSE_ERROR", "RPC_TIMEOUT"].includes(error.code)
}

async function fetchLogRange(
	client: HarnessRpcClient,
	fromBlock: bigint,
	toBlock: bigint,
	topic: Hex,
): Promise<readonly RpcLog[]> {
	try {
		const logs = await client.request<unknown>("eth_getLogs", [
			{
				address: FIXED_PRICE_FLOW_PROXY,
				fromBlock: toHex(fromBlock),
				toBlock: toHex(toBlock),
				topics: [topic],
			},
		])
		if (!Array.isArray(logs)) {
			throw new ProbeError("RPC_DATA_INVALID", "eth_getLogs did not return an array")
		}
		return logs as readonly RpcLog[]
	} catch (error) {
		const blockCount = toBlock - fromBlock + 1n
		if (!shouldSplitLogRange(error) || blockCount <= MINIMUM_RETRY_LOG_BLOCK_SPAN) {
			throw error
		}
		const midpoint = fromBlock + (toBlock - fromBlock) / 2n
		const [left, right] = await Promise.all([
			fetchLogRange(client, fromBlock, midpoint, topic),
			fetchLogRange(client, midpoint + 1n, toBlock, topic),
		])
		return [...left, ...right]
	}
}

async function fetchLogs(client: HarnessRpcClient, headBlock: bigint, blockSpan: bigint): Promise<readonly RpcLog[]> {
	if (blockSpan < 1n) {
		throw new ProbeError("RPC_DATA_INVALID", "logBlockSpan must be positive")
	}

	const topic = encodeEventTopics({
		abi: fixedPriceFlowAbi,
		eventName: "Submit",
	})[0]
	const logs: RpcLog[] = []
	for (let fromBlock = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK; fromBlock <= headBlock; fromBlock += blockSpan) {
		const toBlock = fromBlock + blockSpan - 1n > headBlock ? headBlock : fromBlock + blockSpan - 1n
		logs.push(...(await fetchLogRange(client, fromBlock, toBlock, topic)))
	}
	return logs
}

function compareRawLogs(left: RpcLog, right: RpcLog): number {
	const leftBlock = parseQuantity(left.blockNumber, "log.blockNumber")
	const rightBlock = parseQuantity(right.blockNumber, "log.blockNumber")
	if (leftBlock !== rightBlock) {
		return leftBlock < rightBlock ? -1 : 1
	}
	const leftTransaction = parseSafeIndex(left.transactionIndex, "log.transactionIndex")
	const rightTransaction = parseSafeIndex(right.transactionIndex, "log.transactionIndex")
	if (leftTransaction !== rightTransaction) {
		return leftTransaction - rightTransaction
	}
	return parseSafeIndex(left.logIndex, "log.logIndex") - parseSafeIndex(right.logIndex, "log.logIndex")
}

async function timestampForLog(client: HarnessRpcClient, log: RpcLog, cache: Map<Hex, bigint>): Promise<bigint> {
	if (log.blockTimestamp !== undefined) {
		return parseQuantity(log.blockTimestamp, "log.blockTimestamp")
	}

	const blockHash = requireHex(log.blockHash, 32, "log.blockHash")
	const cached = cache.get(blockHash)
	if (cached !== undefined) {
		return cached
	}

	const blockNumber = toHex(parseQuantity(log.blockNumber, "log.blockNumber"))
	const block = await client.request<RpcBlock | null>("eth_getBlockByNumber", [blockNumber, false])
	if (!block) {
		throw new ProbeError("RPC_DATA_INVALID", `Block ${blockNumber} is unavailable`)
	}
	const returnedHash = requireHex(block.hash, 32, "block.hash")
	if (returnedHash.toLowerCase() !== blockHash.toLowerCase()) {
		throw new ProbeError("RPC_DATA_INVALID", `Block hash changed while reading timestamp for ${blockNumber}`)
	}
	const timestamp = parseQuantity(block.timestamp, "block.timestamp")
	cache.set(blockHash, timestamp)
	return timestamp
}

async function normalizeRawLog(
	client: HarnessRpcClient,
	log: RpcLog,
	timestampCache: Map<Hex, bigint>,
): Promise<StorageSubmission> {
	if (log.removed) {
		throw new ProbeError("REMOVED_LOG", "Live capture returned a removed log")
	}

	const address = requireAddress(log.address, "log.address")
	requireExpectedAddress(address, FIXED_PRICE_FLOW_PROXY, "RPC_DATA_INVALID", "Submit log address")
	const data = typeof log.data === "string" ? log.data : "0x"
	const topics = log.topics
	if (!isHex(data, { strict: true }) || !topics || topics.length === 0) {
		throw new ProbeError("RPC_DATA_INVALID", "Submit log data or topics are missing")
	}
	const decoded = decodeEventLog({
		abi: fixedPriceFlowAbi,
		data,
		strict: true,
		topics: [...topics] as [Hex, ...Hex[]],
	})
	if (decoded.eventName !== "Submit") {
		throw new ProbeError("RPC_DATA_INVALID", `Unexpected event ${decoded.eventName}`)
	}

	const input: SubmitLogInput = {
		address,
		args: decoded.args,
		blockHash: requireHex(log.blockHash, 32, "log.blockHash"),
		blockNumber: parseQuantity(log.blockNumber, "log.blockNumber"),
		blockTimestamp: await timestampForLog(client, log, timestampCache),
		logIndex: parseSafeIndex(log.logIndex, "log.logIndex"),
		transactionHash: requireHex(log.transactionHash, 32, "log.transactionHash"),
		transactionIndex: parseSafeIndex(log.transactionIndex, "log.transactionIndex"),
		...(log.transactionLogIndex === undefined || log.transactionLogIndex === null
			? {}
			: { transactionLogIndex: parseSafeIndex(log.transactionLogIndex, "log.transactionLogIndex") }),
	}
	return normalizeSubmitLog(input, {
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
	})
}

export async function runProbe(client: HarnessRpcClient, options: ProbeOptions = {}): Promise<ProbeResult> {
	const chainId = parseQuantity(await client.request("eth_chainId"), "eth_chainId")
	if (chainId !== BigInt(CONFLUX_ESPACE_TESTNET_CHAIN_ID)) {
		throw new ProbeError(
			"CHAIN_ID_MISMATCH",
			`Connected chain is ${chainId}; expected ${CONFLUX_ESPACE_TESTNET_CHAIN_ID}`,
		)
	}

	const headBlockNumber = parseQuantity(await client.request("eth_blockNumber"), "eth_blockNumber")
	if (headBlockNumber < FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK) {
		throw new ProbeError("HEAD_BLOCK_INVALID", "Current head predates the FixedPriceFlow deployment")
	}
	const blockTag = toHex(headBlockNumber)
	const headBlock = await client.request<RpcBlock | null>("eth_getBlockByNumber", [blockTag, false])
	if (!headBlock) {
		throw new ProbeError("HEAD_BLOCK_INVALID", "Current head block is unavailable")
	}
	const headBlockHash = requireHex(headBlock.hash, 32, "headBlock.hash")
	const headTimestamp = parseQuantity(headBlock.timestamp, "headBlock.timestamp")

	requireCode(
		await client.request("eth_getCode", [FIXED_PRICE_FLOW_PROXY, blockTag]),
		"PROXY_CODE_MISSING",
		"FixedPriceFlow proxy",
	)
	const beacon = beaconFromStorage(
		await client.request("eth_getStorageAt", [FIXED_PRICE_FLOW_PROXY, EIP1967_BEACON_SLOT, blockTag]),
	)
	requireExpectedAddress(beacon, FIXED_PRICE_FLOW_BEACON, "BEACON_MISMATCH", "FixedPriceFlow beacon")
	requireCode(await client.request("eth_getCode", [beacon, blockTag]), "BEACON_CODE_MISSING", "FixedPriceFlow beacon")

	const implementation = requireAddress(
		await readFunction(client, beacon, blockTag, beaconAbi, "implementation"),
		"beacon.implementation()",
	)
	requireExpectedAddress(
		implementation,
		FIXED_PRICE_FLOW_IMPLEMENTATION,
		"IMPLEMENTATION_MISMATCH",
		"FixedPriceFlow implementation",
	)
	const market = requireAddress(
		await readFunction(client, FIXED_PRICE_FLOW_PROXY, blockTag, fixedPriceFlowAbi, "market"),
		"proxy.market()",
	)
	requireExpectedAddress(market, FIXED_PRICE_FLOW_MARKET, "MARKET_MISMATCH", "FixedPriceFlow market")
	const paused = await readFunction(client, FIXED_PRICE_FLOW_PROXY, blockTag, fixedPriceFlowAbi, "paused")
	const submissionIndex = await readFunction(
		client,
		FIXED_PRICE_FLOW_PROXY,
		blockTag,
		fixedPriceFlowAbi,
		"submissionIndex",
	)
	const tree = await readFunction(client, FIXED_PRICE_FLOW_PROXY, blockTag, fixedPriceFlowAbi, "tree")
	if (
		typeof paused !== "boolean" ||
		typeof submissionIndex !== "bigint" ||
		!Array.isArray(tree) ||
		typeof tree[0] !== "bigint" ||
		typeof tree[1] !== "bigint"
	) {
		throw new ProbeError("RPC_DATA_INVALID", "FixedPriceFlow view response types are invalid")
	}

	const rawLogs = [...(await fetchLogs(client, headBlockNumber, options.logBlockSpan ?? DEFAULT_LOG_BLOCK_SPAN))].sort(
		compareRawLogs,
	)
	const timestampCache = new Map<Hex, bigint>()
	const submissions = await Promise.all(rawLogs.map((log) => normalizeRawLog(client, log, timestampCache)))

	return {
		identity: {
			chainId: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
			proxy: FIXED_PRICE_FLOW_PROXY,
			beacon,
			implementation,
			market,
		},
		headBlock: {
			number: headBlockNumber,
			hash: headBlockHash,
			timestamp: headTimestamp,
		},
		state: {
			paused,
			submissionIndex,
			currentLength: tree[0],
			unstagedHeight: tree[1],
		},
		rawLogs,
		submissions,
		featureFlags: {
			blockTimestamp: rawLogs.every((log) => log.blockTimestamp !== undefined),
			transactionLogIndex: rawLogs.every((log) => log.transactionLogIndex !== undefined),
		},
	}
}

export function formatProbeSummary(result: ProbeResult): string {
	return [
		`chain=${result.identity.chainId}`,
		"proxy=ok",
		"beacon=ok",
		"implementation=ok",
		"market=ok",
		`submissions=${result.state.submissionIndex}`,
		`logs=${result.rawLogs.length}`,
		`paused=${result.state.paused}`,
	].join(" ")
}

function getRpcUrl(): string {
	const rpcUrl = process.env.VITE_CONFLUX_ESPACE_RPC_URL?.trim()
	if (!rpcUrl) {
		throw new ProbeError("RPC_DATA_INVALID", "VITE_CONFLUX_ESPACE_RPC_URL must be set for an explicit live probe")
	}
	return rpcUrl
}

async function main(): Promise<void> {
	const client = createRpcClient({ url: getRpcUrl() })
	const result = await runProbe(client)
	process.stdout.write(`${formatProbeSummary(result)}\n`)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
	main().catch((error: unknown) => {
		const name = error instanceof Error ? error.name : "Error"
		const message = error instanceof Error ? error.message : "Unknown probe failure"
		process.stderr.write(`${name}: ${message}\n`)
		process.exitCode = 1
	})
}

import { pathToFileURL } from "node:url"
import { createPublicClient, http } from "viem"
import {
	CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	CONFLUX_ESPACE_TESTNET_RPC_URL,
	confluxESpaceTestnet,
	FIXED_PRICE_FLOW_PROXY,
} from "../../src/chain/config"
import { CONFLUX_STORAGE_NODE_URLS } from "../../src/storage/config"
import { inspectStorageNodes, type StorageNodeHealth } from "../../src/storage/node/node-pool"
import { HttpStorageNodeClient, type StorageNodeClient } from "../../src/storage/node/storage-node-client"

export interface StorageNodeProbeChainClient {
	getBlockNumber(): Promise<bigint>
	getChainId(): Promise<number>
}

export interface StorageNodeProbeOptions {
	readonly chainClient?: StorageNodeProbeChainClient
	readonly clients?: readonly StorageNodeClient[]
	readonly txSeq?: number
}

export interface StorageNodeProbeResult {
	readonly chain: {
		readonly chainId: number
		readonly flowAddress: string
		readonly headBlock: bigint
	}
	readonly nodes: readonly {
		readonly blockLag?: bigint
		readonly fileInfo: Awaited<ReturnType<StorageNodeClient["getFileInfoByTxSeq"]>>
		readonly healthy: boolean
		readonly latencyMs: number
		readonly reason?: string
		readonly shard?: StorageNodeHealth["shard"]
		readonly status?: StorageNodeHealth["status"]
		readonly url: string
	}[]
	readonly selectedNode?: string
	readonly txSeq?: number
}

function createProbeChainClient(): StorageNodeProbeChainClient {
	const rpcUrl = process.env.VITE_CONFLUX_ESPACE_RPC_URL?.trim() || CONFLUX_ESPACE_TESTNET_RPC_URL
	return createPublicClient({
		chain: confluxESpaceTestnet,
		transport: http(rpcUrl, { timeout: 15_000 }),
	})
}

function requireTxSeq(value: string): number {
	if (!/^(?:0|[1-9]\d*)$/.test(value)) {
		throw new TypeError("TxSeq must be a non-negative safe integer")
	}
	const txSeq = Number(value)
	if (!Number.isSafeInteger(txSeq)) {
		throw new TypeError("TxSeq must be a non-negative safe integer")
	}
	return txSeq
}

export function parseStorageNodeProbeTxSeq(argumentsList: readonly string[]): number | undefined {
	const raw = argumentsList
		.find((argument) => argument.startsWith("--tx-seq=") || /^(?:0|[1-9]\d*)$/.test(argument))
		?.replace(/^--tx-seq=/, "")
	return raw === undefined ? undefined : requireTxSeq(raw)
}

export async function runStorageNodeProbe({
	chainClient = createProbeChainClient(),
	clients = CONFLUX_STORAGE_NODE_URLS.map((url) => new HttpStorageNodeClient(url)),
	txSeq,
}: StorageNodeProbeOptions = {}): Promise<StorageNodeProbeResult> {
	const [chainId, headBlock] = await Promise.all([chainClient.getChainId(), chainClient.getBlockNumber()])
	if (chainId !== CONFLUX_ESPACE_TESTNET_CHAIN_ID) {
		throw new Error(`Configured RPC returned chain ${chainId}; expected ${CONFLUX_ESPACE_TESTNET_CHAIN_ID}`)
	}

	const health = await inspectStorageNodes({
		chainHead: headBlock,
		clients,
		...(txSeq === undefined ? {} : { requiredTxSeq: txSeq }),
	})
	const nodes = await Promise.all(
		health.map(async (node) => ({
			blockLag: node.blockLag,
			fileInfo: txSeq === undefined ? null : await node.client.getFileInfoByTxSeq(txSeq),
			healthy: node.healthy,
			latencyMs: Math.round(node.latencyMs),
			reason: node.reason,
			shard: node.shard,
			status: node.status,
			url: node.client.url,
		})),
	)
	const selectedNode = health.find((node) => node.healthy)?.client.url

	return {
		chain: {
			chainId,
			flowAddress: FIXED_PRICE_FLOW_PROXY,
			headBlock,
		},
		nodes,
		...(selectedNode === undefined ? {} : { selectedNode }),
		...(txSeq === undefined ? {} : { txSeq }),
	}
}

function stringifyProbeResult(result: StorageNodeProbeResult): string {
	return JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString(10) : value), 2)
}

async function main() {
	const txSeq = parseStorageNodeProbeTxSeq(process.argv.slice(2))
	const result = await runStorageNodeProbe({
		...(txSeq === undefined ? {} : { txSeq }),
	})
	process.stdout.write(`${stringifyProbeResult(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
		process.exitCode = 1
	})
}

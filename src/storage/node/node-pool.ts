import { isAddressEqual } from "viem"
import { FIXED_PRICE_FLOW_PROXY } from "../../chain/config"
import { CONFLUX_ESPACE_TESTNET_CHAIN_ID } from "../../chain/config"
import { STORAGE_NODE_MAX_BLOCK_LAG } from "../config"
import { StoragePocError, type StorageNodeStatus, type StorageShardConfig } from "../types"
import type { StorageNodeClient } from "./storage-node-client"

export type StorageNodeHealthReason =
	| "incomplete-shard"
	| "lagging"
	| "sequence-unavailable"
	| "unreachable"
	| "wrong-chain"
	| "wrong-flow"

export interface StorageNodeHealth {
	readonly blockLag?: bigint
	readonly client: StorageNodeClient
	readonly healthy: boolean
	readonly latencyMs: number
	readonly reason?: StorageNodeHealthReason
	readonly shard?: StorageShardConfig
	readonly status?: StorageNodeStatus
}

export interface HealthyStorageNode extends StorageNodeHealth {
	readonly blockLag: bigint
	readonly healthy: true
	readonly reason?: undefined
	readonly shard: StorageShardConfig
	readonly status: StorageNodeStatus
}

export interface SelectStorageNodeInput {
	readonly chainHead: bigint
	readonly clients: readonly StorageNodeClient[]
	readonly requiredTxSeq?: number
}

function unhealthy(
	client: StorageNodeClient,
	latencyMs: number,
	reason: StorageNodeHealthReason,
	status?: StorageNodeStatus,
	shard?: StorageShardConfig,
	blockLag?: bigint,
): StorageNodeHealth {
	return {
		blockLag,
		client,
		healthy: false,
		latencyMs,
		reason,
		shard,
		status,
	}
}

async function inspectStorageNode(
	client: StorageNodeClient,
	chainHead: bigint,
	requiredTxSeq?: number,
): Promise<StorageNodeHealth> {
	const startedAt = performance.now()
	let status: StorageNodeStatus
	let shard: StorageShardConfig
	try {
		;[status, shard] = await Promise.all([client.getStatus(), client.getShardConfig()])
	} catch {
		return unhealthy(client, performance.now() - startedAt, "unreachable")
	}
	const latencyMs = performance.now() - startedAt
	const blockLag = chainHead > status.logSyncHeight ? chainHead - status.logSyncHeight : 0n

	if (status.networkIdentity.chainId !== CONFLUX_ESPACE_TESTNET_CHAIN_ID) {
		return unhealthy(client, latencyMs, "wrong-chain", status, shard, blockLag)
	}
	if (!isAddressEqual(status.networkIdentity.flowAddress, FIXED_PRICE_FLOW_PROXY)) {
		return unhealthy(client, latencyMs, "wrong-flow", status, shard, blockLag)
	}
	if (blockLag > STORAGE_NODE_MAX_BLOCK_LAG) {
		return unhealthy(client, latencyMs, "lagging", status, shard, blockLag)
	}
	if (shard.numShard !== 1 || shard.shardId !== 0) {
		return unhealthy(client, latencyMs, "incomplete-shard", status, shard, blockLag)
	}
	if (requiredTxSeq !== undefined && status.nextTxSeq <= requiredTxSeq) {
		return unhealthy(client, latencyMs, "sequence-unavailable", status, shard, blockLag)
	}

	return {
		blockLag,
		client,
		healthy: true,
		latencyMs,
		shard,
		status,
	}
}

export async function inspectStorageNodes({
	chainHead,
	clients,
	requiredTxSeq,
}: SelectStorageNodeInput): Promise<readonly StorageNodeHealth[]> {
	return Promise.all(clients.map((client) => inspectStorageNode(client, chainHead, requiredTxSeq)))
}

function isHealthyStorageNode(health: StorageNodeHealth): health is HealthyStorageNode {
	return health.healthy && health.status !== undefined && health.shard !== undefined && health.blockLag !== undefined
}

export async function selectStorageNode(input: SelectStorageNodeInput): Promise<HealthyStorageNode> {
	const healthyNodes = (await inspectStorageNodes(input)).filter(isHealthyStorageNode)
	healthyNodes.sort((left, right) => {
		if (left.status.logSyncHeight !== right.status.logSyncHeight) {
			return left.status.logSyncHeight > right.status.logSyncHeight ? -1 : 1
		}
		return left.latencyMs - right.latencyMs
	})

	const selected = healthyNodes[0]
	if (!selected) {
		throw new StoragePocError("NO_HEALTHY_NODE", "No healthy Conflux Storage Node is available")
	}
	return selected
}

import type { HealthyStorageNode } from "../node/node-pool"
import type { StorageNodeClient } from "../node/storage-node-client"
import type { PreparedStorageFile } from "../sdk/prepare-file"
import { StoragePocError } from "../types"
import type { StorageUploadProgress } from "./upload-segments"
import type { WaitForNodeFileInfoInput } from "./wait-for-node"

export function shouldFailOverStorageNode(error: unknown): boolean {
	if (!(error instanceof StoragePocError)) {
		return false
	}
	return (
		error.code === "HTTP_ERROR" ||
		error.code === "MALFORMED_RESPONSE" ||
		error.code === "NETWORK_ERROR" ||
		error.code === "NODE_SYNC_TIMEOUT" ||
		error.code === "RPC_ERROR" ||
		error.code === "TIMEOUT" ||
		error.code === "UPLOAD_FAILED"
	)
}

export interface UploadViaHealthyNodesInput {
	readonly nodes: readonly HealthyStorageNode[]
	readonly onNodeReady?: (node: HealthyStorageNode) => Promise<void> | void
	readonly onProgress?: (progress: StorageUploadProgress) => void
	readonly prepared: PreparedStorageFile
	readonly txSeq: number
	readonly upload: (input: {
		readonly client: StorageNodeClient
		readonly onProgress?: (progress: StorageUploadProgress) => void
		readonly prepared: PreparedStorageFile
		readonly txSeq: number
	}) => Promise<void>
	readonly waitForFile: (
		input: Omit<WaitForNodeFileInfoInput, "client"> & { readonly client: StorageNodeClient },
	) => Promise<unknown>
}

export async function uploadViaHealthyNodes({
	nodes,
	onNodeReady,
	onProgress,
	prepared,
	txSeq,
	upload,
	waitForFile,
}: UploadViaHealthyNodesInput): Promise<HealthyStorageNode> {
	if (nodes.length === 0) {
		throw new StoragePocError("NO_HEALTHY_NODE", "No healthy Conflux Storage Node is available")
	}

	let lastError: unknown
	for (let index = 0; index < nodes.length; index += 1) {
		const node = nodes[index]
		if (!node) {
			continue
		}
		try {
			await waitForFile({
				client: node.client,
				expectedRoot: prepared.root,
				expectedSize: prepared.source.size,
				txSeq,
			})
			await onNodeReady?.(node)
			await upload({
				client: node.client,
				onProgress,
				prepared,
				txSeq,
			})
			return node
		} catch (error) {
			lastError = error
			const hasNextNode = index < nodes.length - 1
			if (hasNextNode && shouldFailOverStorageNode(error)) {
				continue
			}
			throw error
		}
	}

	throw lastError instanceof Error ? lastError : new StoragePocError("UPLOAD_FAILED", "Storage Node upload failed")
}

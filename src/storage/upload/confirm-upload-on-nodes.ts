import type { Hex } from "viem"
import { STORAGE_NODE_POLL_INTERVAL_MS, STORAGE_UPLOAD_CONFIRM_TIMEOUT_MS } from "../config"
import type { HealthyStorageNode } from "../node/node-pool"
import { type StorageNodeFileInfo, StoragePocError } from "../types"

export interface ConfirmUploadOnHealthyNodesInput {
	readonly expectedRoot: Hex
	readonly expectedSegments: number
	readonly expectedSize: number
	readonly nodes: readonly HealthyStorageNode[]
	readonly now?: () => number
	readonly pollIntervalMs?: number
	readonly sleep?: (milliseconds: number) => Promise<void>
	readonly timeoutMs?: number
	readonly txSeq: number
}

const sleepFor = (milliseconds: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, milliseconds)
	})

function isUploadConfirmed(
	info: StorageNodeFileInfo,
	txSeq: number,
	expectedRoot: Hex,
	expectedSize: number,
	expectedSegments: number,
): boolean {
	return (
		info.tx.seq === txSeq &&
		info.tx.dataMerkleRoot.toLowerCase() === expectedRoot.toLowerCase() &&
		info.tx.size === expectedSize &&
		info.uploadedSegNum >= expectedSegments
	)
}

export async function confirmUploadOnHealthyNodes({
	expectedRoot,
	expectedSegments,
	expectedSize,
	nodes,
	now = Date.now,
	pollIntervalMs = STORAGE_NODE_POLL_INTERVAL_MS,
	sleep = sleepFor,
	timeoutMs = STORAGE_UPLOAD_CONFIRM_TIMEOUT_MS,
	txSeq,
}: ConfirmUploadOnHealthyNodesInput): Promise<HealthyStorageNode> {
	if (nodes.length === 0) {
		throw new StoragePocError("NO_HEALTHY_NODE", "No healthy Conflux Storage Node is available")
	}

	const deadline = now() + timeoutMs

	while (now() <= deadline) {
		for (const node of nodes) {
			try {
				const info = await node.client.getFileInfoByTxSeq(txSeq)
				if (info && isUploadConfirmed(info, txSeq, expectedRoot, expectedSize, expectedSegments)) {
					return node
				}
			} catch {
				// Try the next node when one endpoint fails during confirmation.
			}
		}

		const remaining = deadline - now()
		if (remaining <= 0) {
			break
		}
		await sleep(Math.min(pollIntervalMs, remaining))
	}

	throw new StoragePocError("UPLOAD_NOT_CONFIRMED", `Storage Node did not confirm TxSeq ${txSeq} before the timeout`)
}

import type { Hex } from "viem"
import { STORAGE_NODE_POLL_INTERVAL_MS, STORAGE_NODE_SYNC_TIMEOUT_MS } from "../config"
import type { StorageNodeClient } from "../node/storage-node-client"
import { type StorageNodeFileInfo, StoragePocError } from "../types"

export interface WaitForNodeFileInfoInput {
	readonly client: StorageNodeClient
	readonly expectedRoot: Hex
	readonly expectedSize: number
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

function validateFileInfo(info: StorageNodeFileInfo, txSeq: number, expectedRoot: Hex, expectedSize: number): void {
	if (
		info.tx.seq !== txSeq ||
		info.tx.dataMerkleRoot.toLowerCase() !== expectedRoot.toLowerCase() ||
		info.tx.size !== expectedSize
	) {
		throw new StoragePocError("FILE_INFO_MISMATCH", "Storage Node FileInfo does not match the submitted file")
	}
}

export async function waitForNodeFileInfo({
	client,
	expectedRoot,
	expectedSize,
	now = Date.now,
	pollIntervalMs = STORAGE_NODE_POLL_INTERVAL_MS,
	sleep = sleepFor,
	timeoutMs = STORAGE_NODE_SYNC_TIMEOUT_MS,
	txSeq,
}: WaitForNodeFileInfoInput): Promise<StorageNodeFileInfo> {
	const deadline = now() + timeoutMs

	while (now() <= deadline) {
		const info = await client.getFileInfoByTxSeq(txSeq)
		if (info) {
			validateFileInfo(info, txSeq, expectedRoot, expectedSize)
			return info
		}
		const remaining = deadline - now()
		if (remaining <= 0) {
			break
		}
		await sleep(Math.min(pollIntervalMs, remaining))
	}

	throw new StoragePocError("NODE_SYNC_TIMEOUT", `Storage Node did not synchronize TxSeq ${txSeq} before the timeout`)
}

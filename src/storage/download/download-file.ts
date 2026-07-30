import { decodeBase64 } from "ethers"
import { type Hex, zeroAddress } from "viem"
import { STORAGE_CHUNK_BYTES, STORAGE_POC_MAX_FILE_BYTES, STORAGE_SEGMENT_CHUNKS } from "../config"
import { resolveStorageDownloadMetadata } from "../metadata/file-metadata"
import type { StorageNodeClient } from "../node/storage-node-client"
import { prepareStorageFile } from "../sdk/prepare-file"
import { type StorageNodeFileInfo, StoragePocError } from "../types"

export type StorageDownloadTarget = { readonly root: Hex } | { readonly txSeq: number }

export interface DownloadAndVerifyStorageFileInput {
	readonly client: StorageNodeClient
	readonly originalFile?: File
	readonly resolveSubmission?: (txSeq: number) => Promise<StorageDownloadSubmission | undefined>
	readonly target: StorageDownloadTarget
}

export interface StorageDownloadSubmission {
	readonly logicalSizeBytes: bigint
	readonly tags: Hex
}

export interface StorageDownloadResult {
	readonly bytesEqual?: boolean
	readonly file: File
	readonly fileMetadataRecovered: boolean
	readonly root: Hex
	readonly txSeq: number
	readonly verified: true
}

async function resolveFileInfo(client: StorageNodeClient, target: StorageDownloadTarget): Promise<StorageNodeFileInfo> {
	const info =
		"txSeq" in target ? await client.getFileInfoByTxSeq(target.txSeq) : await client.getFileInfo(target.root, true)
	if (!info || info.pruned) {
		throw new StoragePocError("DOWNLOAD_NOT_FOUND", "File is not available on the selected Storage Node")
	}
	if ("root" in target && info.tx.dataMerkleRoot.toLowerCase() !== target.root.toLowerCase()) {
		throw new StoragePocError("INTEGRITY_MISMATCH", "Storage Node FileInfo Root does not match the requested Root")
	}
	return info
}

async function compareFiles(left: File, right: File): Promise<boolean> {
	if (left.size !== right.size) {
		return false
	}
	const comparisonBytes = 1024 * 1024
	for (let offset = 0; offset < left.size; offset += comparisonBytes) {
		const end = Math.min(offset + comparisonBytes, left.size)
		const [leftBytes, rightBytes] = await Promise.all([
			left.slice(offset, end).arrayBuffer(),
			right.slice(offset, end).arrayBuffer(),
		])
		const leftView = new Uint8Array(leftBytes)
		const rightView = new Uint8Array(rightBytes)
		if (leftView.length !== rightView.length || leftView.some((byte, index) => byte !== rightView[index])) {
			return false
		}
	}
	return true
}

export async function downloadAndVerifyStorageFile({
	client,
	originalFile,
	resolveSubmission,
	target,
}: DownloadAndVerifyStorageFileInput): Promise<StorageDownloadResult> {
	const info = await resolveFileInfo(client, target)
	if (info.tx.size === 0) {
		throw new StoragePocError("DOWNLOAD_FAILED", "Empty Storage Node files are not supported by this POC")
	}
	if (info.tx.size > STORAGE_POC_MAX_FILE_BYTES) {
		throw new StoragePocError(
			"FILE_TOO_LARGE",
			`File exceeds the ${STORAGE_POC_MAX_FILE_BYTES}-byte POC download limit`,
		)
	}
	let submission: StorageDownloadSubmission | undefined
	try {
		submission = await resolveSubmission?.(info.tx.seq)
	} catch {
		submission = undefined
	}
	if (submission && submission.logicalSizeBytes !== BigInt(info.tx.size)) {
		throw new StoragePocError("FILE_INFO_MISMATCH", "Canonical Submit size does not match Storage Node FileInfo")
	}
	const downloadMetadata = originalFile
		? {
				fileName: originalFile.name,
				mediaType: originalFile.type || "application/octet-stream",
				recovered: true,
			}
		: resolveStorageDownloadMetadata(submission?.tags, info.tx.seq)

	const chunkCount = Math.ceil(info.tx.size / STORAGE_CHUNK_BYTES)
	const segmentCount = Math.ceil(chunkCount / STORAGE_SEGMENT_CHUNKS)
	const parts: ArrayBuffer[] = []
	for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
		const startChunk = segmentIndex * STORAGE_SEGMENT_CHUNKS
		const endChunk = Math.min(startChunk + STORAGE_SEGMENT_CHUNKS, chunkCount)
		const encoded = await client.downloadSegmentByTxSeq(info.tx.seq, startChunk, endChunk)
		if (!encoded) {
			throw new StoragePocError("DOWNLOAD_FAILED", `Storage Node returned no data for Segment ${segmentIndex}`)
		}
		try {
			parts.push(Uint8Array.from(decodeBase64(encoded)).buffer)
		} catch (cause) {
			throw new StoragePocError("DOWNLOAD_FAILED", `Storage Node returned invalid Base64 for Segment ${segmentIndex}`, {
				cause,
			})
		}
	}

	const downloaded = new Blob(parts).slice(0, info.tx.size)
	if (downloaded.size !== info.tx.size) {
		throw new StoragePocError("DOWNLOAD_FAILED", "Storage Node returned fewer bytes than FileInfo declares")
	}
	const file = new File([downloaded], downloadMetadata.fileName, {
		type: downloadMetadata.mediaType,
	})
	const prepared = await prepareStorageFile(file, zeroAddress)
	if (prepared.root.toLowerCase() !== info.tx.dataMerkleRoot.toLowerCase()) {
		throw new StoragePocError("INTEGRITY_MISMATCH", "Downloaded file Merkle Root does not match Storage Node FileInfo")
	}

	const bytesEqual = originalFile ? await compareFiles(file, originalFile) : undefined
	if (bytesEqual === false) {
		throw new StoragePocError("INTEGRITY_MISMATCH", "Downloaded bytes do not match the original file")
	}

	return {
		...(bytesEqual === undefined ? {} : { bytesEqual }),
		file,
		fileMetadataRecovered: downloadMetadata.recovered,
		root: prepared.root,
		txSeq: info.tx.seq,
		verified: true,
	}
}

import { type MerkleTree, Blob as ZgBlob } from "@0gfoundation/0g-storage-ts-sdk/browser"
import { encodeBase64 } from "ethers"
import { type Address, getAddress, type Hex, isAddress, isHex, size } from "viem"
import { calculateSubmissionIdentity } from "../../chain/normalize/submission-identity"
import {
	STORAGE_CHUNK_BYTES,
	STORAGE_POC_MAX_FILE_BYTES,
	STORAGE_SEGMENT_BYTES,
	STORAGE_SEGMENT_CHUNKS,
} from "../config"
import { encodeStorageFileMetadata } from "../metadata/file-metadata"
import { StoragePocError, type StorageSegmentProof, type StorageSegmentWithProof } from "../types"

export interface PreparedStorageSubmission {
	readonly data: {
		readonly length: bigint
		readonly nodes: readonly {
			readonly height: bigint
			readonly root: Hex
		}[]
		readonly tags: Hex
	}
	readonly submitter: Address
}

export interface PreparedStorageFile {
	readonly chunkCount: number
	readonly identity: Hex
	readonly root: Hex
	readonly sdkFile: ZgBlob
	readonly segmentCount: number
	readonly source: File
	readonly submission: PreparedStorageSubmission
	readonly tree: MerkleTree
}

function requireHash(value: unknown, label: string): Hex {
	if (typeof value !== "string" || !isHex(value, { strict: true }) || size(value) !== 32) {
		throw new StoragePocError("SDK_ERROR", `0G SDK returned an invalid ${label}`)
	}
	return value
}

function normalizeBigInt(value: unknown, label: string): bigint {
	try {
		const result = BigInt(String(value))
		if (result < 0n) {
			throw new Error("negative")
		}
		return result
	} catch (cause) {
		throw new StoragePocError("SDK_ERROR", `0G SDK returned an invalid ${label}`, {
			cause,
		})
	}
}

function normalizeProof(lemma: readonly unknown[], path: readonly boolean[]): StorageSegmentProof {
	return {
		lemma: lemma.map((hash, index) => requireHash(hash, `proof lemma ${index}`)),
		path: [...path],
	}
}

export async function prepareStorageFile(file: File, submitter: Address): Promise<PreparedStorageFile> {
	if (file.size === 0) {
		throw new StoragePocError("EMPTY_FILE", "Choose a non-empty file")
	}
	if (file.size > STORAGE_POC_MAX_FILE_BYTES) {
		throw new StoragePocError("FILE_TOO_LARGE", `File exceeds the ${STORAGE_POC_MAX_FILE_BYTES}-byte POC limit`)
	}
	if (!isAddress(submitter)) {
		throw new StoragePocError("INVALID_ARGUMENT", "Submitter must be a valid EVM address")
	}

	const normalizedSubmitter = getAddress(submitter)
	const sdkFile = new ZgBlob(file)
	const [tree, treeError] = await sdkFile.merkleTree()
	if (treeError || !tree) {
		throw new StoragePocError("SDK_ERROR", "0G SDK failed to build the file Merkle tree", {
			cause: treeError ?? undefined,
		})
	}
	const root = requireHash(tree.rootHash(), "Merkle Root")
	const tags = encodeStorageFileMetadata(file)
	const [sdkSubmission, submissionError] = await sdkFile.createSubmission(tags, normalizedSubmitter)
	if (submissionError || !sdkSubmission) {
		throw new StoragePocError("SDK_ERROR", "0G SDK failed to create the storage Submission", {
			cause: submissionError ?? undefined,
		})
	}

	const nodes = sdkSubmission.data.nodes.map((node, index) => ({
		height: normalizeBigInt(node.height, `Submission node ${index} height`),
		root: requireHash(node.root, `Submission node ${index} root`),
	}))
	const submission: PreparedStorageSubmission = {
		data: {
			length: BigInt(file.size),
			nodes,
			tags,
		},
		submitter: normalizedSubmitter,
	}

	return {
		chunkCount: sdkFile.numChunks(),
		identity: calculateSubmissionIdentity(nodes.map(({ root: nodeRoot }) => nodeRoot)),
		root,
		sdkFile,
		segmentCount: sdkFile.numSegmentsPadded(),
		source: file,
		submission,
		tree,
	}
}

export async function createStorageSegment(
	prepared: PreparedStorageFile,
	segmentIndex: number,
): Promise<StorageSegmentWithProof> {
	if (!Number.isSafeInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= prepared.segmentCount) {
		throw new StoragePocError("INVALID_ARGUMENT", "Segment index is outside the prepared Merkle tree")
	}

	const iterator = prepared.sdkFile.iterateWithOffsetAndBatch(
		segmentIndex * STORAGE_SEGMENT_BYTES,
		STORAGE_SEGMENT_BYTES,
		true,
	)
	const [ok, iteratorError] = await iterator.next()
	if (iteratorError || !ok) {
		throw new StoragePocError("SDK_ERROR", `0G SDK failed to read Segment ${segmentIndex}`, {
			cause: iteratorError ?? undefined,
		})
	}

	const startChunk = segmentIndex * STORAGE_SEGMENT_CHUNKS
	const remainingChunks = prepared.chunkCount - startChunk
	const includedChunks = Math.min(STORAGE_SEGMENT_CHUNKS, remainingChunks)
	const segment = iterator.current().slice(0, includedChunks * STORAGE_CHUNK_BYTES)
	const proof = prepared.tree.proofAt(segmentIndex)

	return {
		data: encodeBase64(segment),
		fileSize: prepared.source.size,
		index: segmentIndex,
		proof: normalizeProof(proof.lemma, proof.path),
		root: prepared.root,
	}
}

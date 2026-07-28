import type { Address, Hex } from "viem"
import { afterEach, describe, expect, it } from "vitest"
import { FIXED_PRICE_FLOW_IMPLEMENTATION, FIXED_PRICE_FLOW_PROXY } from "../../chain/config"
import type { StorageSubmission } from "../../chain/types"
import { createStorageRepository, type StorageRepository } from "./storage-db"

const oldHash = `0x${"11".repeat(32)}` as Hex
const newHash = `0x${"22".repeat(32)}` as Hex
const transactionHash = `0x${"33".repeat(32)}` as Hex
const submitter = "0x1111111111111111111111111111111111111111" as Address
const repositories: StorageRepository[] = []
let databaseNumber = 0

function makeSubmission(sequence: bigint, blockHash: Hex, blockNumber: bigint): StorageSubmission {
	return {
		canonicalKey: `71:${FIXED_PRICE_FLOW_PROXY.toLowerCase()}:${blockHash}:${transactionHash}:${sequence}`,
		chainId: 71,
		contractAddress: FIXED_PRICE_FLOW_PROXY,
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		sequence,
		submitter,
		submissionIdentity: `0x${"44".repeat(32)}`,
		logicalSizeBytes: 1_234n + sequence,
		startSector: 100n + sequence,
		sectorCount: 9n,
		endSectorExclusive: 109n + sequence,
		nodeRoots: [`0x${"55".repeat(32)}`],
		tags: "0x",
		blockNumber,
		blockHash,
		transactionHash,
		transactionIndex: 0,
		logIndex: Number(sequence),
		timestamp: 1_700_000_000,
	}
}

function repository(implementationAddress = FIXED_PRICE_FLOW_IMPLEMENTATION): StorageRepository {
	databaseNumber += 1
	const instance = createStorageRepository({
		databasePrefix: `conflux-storage-test-${databaseNumber}`,
		implementationAddress,
		normalizerVersion: "1",
		schemaVersion: 1,
	})
	repositories.push(instance)
	return instance
}

afterEach(async () => {
	await Promise.all(repositories.splice(0).map((instance) => instance.clearCurrentNamespace()))
})

describe("IndexedDB storage repository", () => {
	it("replaces orphaned logs and checkpoint atomically", async () => {
		const instance = repository()
		const oldSubmission = makeSubmission(1n, oldHash, 110n)
		const replacementSubmission = makeSubmission(1n, newHash, 110n)

		await instance.applyChunk({
			canonicalBlockHashes: new Map([[110n, oldHash]]),
			fromBlock: 100n,
			submissions: [oldSubmission],
			toBlock: 110n,
		})
		await instance.reconcileWindow({
			canonicalBlockHashes: new Map([[110n, newHash]]),
			fromBlock: 105n,
			submissions: [replacementSubmission],
			toBlock: 112n,
		})

		expect(await instance.getByCanonicalKey(oldSubmission.canonicalKey)).toBeUndefined()
		expect(await instance.getBySequence(1n)).toEqual(replacementSubmission)
		expect(await instance.getCheckpoint()).toMatchObject({ blockNumber: 112n })
		expect(await instance.getBlockTimestamp(newHash)).toBe(replacementSubmission.timestamp)
	})

	it("uses a new namespace when implementation identity changes", async () => {
		const databasePrefix = `conflux-storage-namespace-${databaseNumber++}`
		const original = createStorageRepository({
			databasePrefix,
			implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
			normalizerVersion: "1",
			schemaVersion: 1,
		})
		const upgraded = createStorageRepository({
			databasePrefix,
			implementationAddress: "0x2222222222222222222222222222222222222222",
			normalizerVersion: "1",
			schemaVersion: 1,
		})
		repositories.push(original, upgraded)

		await original.applyChunk({
			canonicalBlockHashes: new Map([[110n, oldHash]]),
			fromBlock: 100n,
			submissions: [makeSubmission(1n, oldHash, 110n)],
			toBlock: 110n,
		})

		expect(original.namespace).not.toBe(upgraded.namespace)
		expect((await original.getSummary()).indexedSubmissionCount).toBe(1n)
		expect((await upgraded.getSummary()).indexedSubmissionCount).toBe(0n)
	})

	it("does not mutate the namespace when reconciliation uses another implementation", async () => {
		const instance = repository()
		const accepted = makeSubmission(1n, oldHash, 110n)
		await instance.applyChunk({
			canonicalBlockHashes: new Map([[110n, oldHash]]),
			fromBlock: 110n,
			submissions: [accepted],
			toBlock: 110n,
		})
		const incompatible = {
			...makeSubmission(1n, newHash, 111n),
			implementationAddress: "0x2222222222222222222222222222222222222222" as Address,
		}

		await expect(
			instance.reconcileWindow({
				canonicalBlockHashes: new Map([[111n, newHash]]),
				fromBlock: 110n,
				submissions: [incompatible],
				toBlock: 111n,
			}),
		).rejects.toMatchObject({
			code: "IMPLEMENTATION_MISMATCH",
		})
		expect(await instance.getByCanonicalKey(accepted.canonicalKey)).toEqual(accepted)
		expect(await instance.getCheckpoint()).toMatchObject({ blockNumber: 110n })
	})

	it("paginates by descending sequence and filters the event submitter", async () => {
		const instance = repository()
		await instance.applyChunk({
			canonicalBlockHashes: new Map([
				[110n, oldHash],
				[111n, newHash],
			]),
			fromBlock: 110n,
			submissions: [makeSubmission(1n, oldHash, 110n), makeSubmission(2n, newHash, 111n)],
			toBlock: 111n,
		})

		await expect(instance.list({ page: 1, pageSize: 1 })).resolves.toMatchObject({
			items: [expect.objectContaining({ sequence: 2n })],
			totalItems: 2,
			totalPages: 2,
		})
		await expect(instance.listBySubmitter({ page: 1, pageSize: 20, submitter })).resolves.toMatchObject({
			items: [expect.objectContaining({ sequence: 2n }), expect.objectContaining({ sequence: 1n })],
			totalItems: 2,
		})
	})
})

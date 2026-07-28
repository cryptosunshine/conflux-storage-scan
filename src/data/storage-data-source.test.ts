import type { PublicClient } from "viem"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import acceptedSubmissionsJson from "../../tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1/expected/submissions.json?raw"
import {
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../chain/config"
import { calculateSubmissionIdentity } from "../chain/normalize/submission-identity"
import type { StorageSyncTransport, SyncSubmitLog } from "../chain/sync/sync-submissions"
import type { StorageSubmission } from "../chain/types"
import { createFixtureDataSource, createFixtureDataSourceFromJson } from "./fixture-data-source"
import { createStorageRepository, type StorageRepository } from "./indexed-db/storage-db"
import { createLiveRpcDataSource, createViemStorageSyncTransport } from "./live-rpc-data-source"
import { storageKeys } from "./queries"
import type { StorageDataSource } from "./storage-data-source"

const submitter = "0x1111111111111111111111111111111111111111" as const
const nodeRoot = `0x${"11".repeat(32)}` as const
const identity = calculateSubmissionIdentity([nodeRoot])
const repositories: StorageRepository[] = []
let databaseNumber = 0

function hash(byte: number) {
	return `0x${byte.toString(16).padStart(2, "0").repeat(32)}` as const
}

function submission(sequence: bigint): StorageSubmission {
	const blockNumber = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + sequence + 1n
	const blockHash = hash(Number(sequence) + 1)
	const transactionHash = hash(Number(sequence) + 100)
	return {
		canonicalKey: `71:${FIXED_PRICE_FLOW_PROXY.toLowerCase()}:${blockHash}:${transactionHash}:${sequence}`,
		chainId: 71,
		contractAddress: FIXED_PRICE_FLOW_PROXY,
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		sequence,
		submitter,
		submissionIdentity: identity,
		logicalSizeBytes: 100n + sequence,
		startSector: sequence,
		sectorCount: 1n,
		endSectorExclusive: sequence + 1n,
		nodeRoots: [nodeRoot],
		tags: "0x",
		blockNumber,
		blockHash,
		transactionHash,
		transactionIndex: 0,
		logIndex: Number(sequence),
		timestamp: 1_700_000_000 + Number(sequence),
	}
}

function serialized(submissions: readonly StorageSubmission[]): unknown {
	return JSON.parse(
		JSON.stringify(submissions, (_key, value: unknown) => (typeof value === "bigint" ? value.toString(10) : value)),
	)
}

function syncLog(item: StorageSubmission): SyncSubmitLog {
	return {
		address: item.contractAddress,
		args: {
			identity: item.submissionIdentity,
			length: item.sectorCount,
			sender: item.submitter,
			startPos: item.startSector,
			submission: {
				length: item.logicalSizeBytes,
				nodes: item.nodeRoots.map((root) => ({ height: 0n, root })),
				tags: item.tags,
			},
			submissionIndex: item.sequence,
		},
		blockHash: item.blockHash,
		blockNumber: item.blockNumber,
		blockTimestamp: item.timestamp,
		logIndex: item.logIndex,
		transactionHash: item.transactionHash,
		transactionIndex: item.transactionIndex,
	}
}

interface DataSourceHarness {
	readonly source: StorageDataSource
	readonly cleanup: () => Promise<void>
}

async function fixtureHarness(): Promise<DataSourceHarness> {
	const source = createFixtureDataSource({
		allocatedSectorCount: 30n,
		contractSubmissionCount: 3n,
		headBlock: FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 3n,
		submissions: [submission(0n), submission(1n), submission(2n)],
	})
	return { source, cleanup: async () => {} }
}

async function liveHarness(): Promise<DataSourceHarness> {
	databaseNumber += 1
	const repository = createStorageRepository({
		databasePrefix: `storage-data-source-${databaseNumber}`,
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		normalizerVersion: "1",
		schemaVersion: 1,
	})
	repositories.push(repository)
	const submissions = [submission(0n), submission(1n), submission(2n)]
	const head = submissions[2]
	if (!head) {
		throw new Error("Missing test head")
	}
	const transport: StorageSyncTransport = {
		getBlock: async (blockNumber) => {
			const item = submissions.find((candidate) => candidate.blockNumber === blockNumber)
			if (!item) {
				throw new Error("Missing test block")
			}
			return {
				hash: item.blockHash,
				number: item.blockNumber,
				timestamp: BigInt(item.timestamp),
			}
		},
		getHeadBlock: async () => ({
			hash: head.blockHash,
			number: head.blockNumber,
		}),
		getSubmitLogs: async (range) =>
			submissions
				.filter((item) => item.blockNumber >= range.fromBlock && item.blockNumber <= range.toBlock)
				.map(syncLog),
		verifyDeployment: async () => ({
			beacon: FIXED_PRICE_FLOW_BEACON,
			chainId: 71,
			implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
			market: FIXED_PRICE_FLOW_MARKET,
			proxy: FIXED_PRICE_FLOW_PROXY,
		}),
	}
	const client = {
		readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
			if (functionName === "submissionIndex") {
				return 3n
			}
			if (functionName === "tree") {
				return [30n, 20n] as const
			}
			throw new Error(`Unexpected function ${functionName}`)
		}),
	} as unknown as PublicClient
	const source = createLiveRpcDataSource({
		client,
		repository,
		transport,
	})
	return {
		source,
		cleanup: () => repository.clearCurrentNamespace(),
	}
}

function storageDataSourceContract(name: string, createHarness: () => Promise<DataSourceHarness>) {
	describe(name, () => {
		let harness: DataSourceHarness

		beforeEach(async () => {
			harness = await createHarness()
			await harness.source.sync()
		})

		afterEach(async () => {
			await harness.cleanup()
		})

		it("returns the same summary projection", async () => {
			await expect(harness.source.getSummary()).resolves.toMatchObject({
				allocatedBytes: 7_680n,
				allocatedSectorCount: 30n,
				contractSubmissionCount: 3n,
				indexedLogicalBytes: 303n,
				indexedSubmissionCount: 3n,
				storageFeeCfx: 0n,
			})
		})

		it("paginates by descending sequence and supports sequence and submitter queries", async () => {
			await expect(harness.source.listSubmissions({ page: 1, pageSize: 2 })).resolves.toMatchObject({
				items: [expect.objectContaining({ sequence: 2n }), expect.objectContaining({ sequence: 1n })],
				totalItems: 3,
				totalPages: 2,
			})
			await expect(harness.source.getSubmission(1n)).resolves.toMatchObject({
				sequence: 1n,
			})
			await expect(
				harness.source.listBySubmitter({
					page: 1,
					pageSize: 20,
					submitter: submitter.toUpperCase(),
				}),
			).resolves.toMatchObject({
				totalItems: 3,
			})
		})

		it("clears only its local index and can repopulate it", async () => {
			await harness.source.rebuildLocalIndex()
			expect((await harness.source.getSummary()).indexedSubmissionCount).toBe(0n)
			await harness.source.sync()
			expect((await harness.source.getSummary()).indexedSubmissionCount).toBe(3n)
		})
	})
}

storageDataSourceContract("FixtureDataSource contract", fixtureHarness)
storageDataSourceContract("LiveRpcDataSource contract", liveHarness)

afterEach(async () => {
	await Promise.all(repositories.splice(0).map((repository) => repository.clearCurrentNamespace()))
})

describe("fixture parsing and query keys", () => {
	it("parses the accepted decimal-string fixture shape", async () => {
		const records = JSON.parse(acceptedSubmissionsJson)
		const source = createFixtureDataSourceFromJson({
			allocatedSectorCount: 290_624n,
			contractSubmissionCount: 485n,
			headBlock: 258_293_674n,
			submissions: records.slice(0, 1),
		})

		expect((await source.getSubmission(0n))?.logicalSizeBytes).toBe(2_867n)
	})

	it("keeps query keys stable and serializable", () => {
		expect(storageKeys.summary()).toEqual(["storage", "summary"])
		expect(storageKeys.submissions(2)).toEqual(["storage", "submissions", 2])
		expect(storageKeys.submission("7")).toEqual(["storage", "submission", "7"])
		expect(storageKeys.address("0x1111111111111111111111111111111111111111", 3)).toEqual([
			"storage",
			"address",
			"0x1111111111111111111111111111111111111111",
			3,
		])
	})

	it("serializes the in-memory test fixture with decimal bigint fields", () => {
		expect(serialized([submission(1n)])).toEqual([expect.objectContaining({ sequence: "1" })])
	})

	it("adapts viem blocks and decoded logs to the sync transport", async () => {
		const item = submission(0n)
		const decodedLog = syncLog(item)
		const client = {
			getBlock: vi.fn(async () => ({
				hash: item.blockHash,
				number: item.blockNumber,
				timestamp: BigInt(item.timestamp),
			})),
			getBlockNumber: vi.fn(async () => item.blockNumber),
			getLogs: vi.fn(async () => [decodedLog]),
		} as unknown as PublicClient
		const transport = createViemStorageSyncTransport(client)

		await expect(transport.getHeadBlock()).resolves.toEqual({
			hash: item.blockHash,
			number: item.blockNumber,
		})
		await expect(
			transport.getSubmitLogs({
				fromBlock: item.blockNumber,
				toBlock: item.blockNumber,
			}),
		).resolves.toEqual([decodedLog])
		await expect(transport.getBlock(item.blockNumber)).resolves.toEqual({
			hash: item.blockHash,
			number: item.blockNumber,
			timestamp: BigInt(item.timestamp),
		})
	})
})

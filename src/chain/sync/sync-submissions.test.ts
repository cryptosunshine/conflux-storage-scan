import type { Address, Hex } from "viem"
import { afterEach, describe, expect, it, type Mock, vi } from "vitest"
import { createStorageRepository, type StorageRepository } from "../../data/indexed-db/storage-db"
import {
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../config"
import { calculateSubmissionIdentity } from "../normalize/submission-identity"
import { DeploymentVerificationError } from "../proxy/verify-deployment"
import { createSubmissionSyncService, type StorageSyncTransport, type SyncSubmitLog } from "./sync-submissions"

const submitter = "0x1111111111111111111111111111111111111111" as Address
const nodeRoot = `0x${"11".repeat(32)}` as Hex
const repositories: StorageRepository[] = []
let repositoryNumber = 0

function hash(byte: number): Hex {
	return `0x${byte.toString(16).padStart(2, "0").repeat(32)}`
}

function makeLog(
	sequence: bigint,
	blockNumber: bigint,
	options: {
		readonly blockHash?: Hex
		readonly blockTimestamp?: bigint
		readonly identity?: Hex
		readonly removed?: boolean
	} = {},
): SyncSubmitLog {
	const blockHash = options.blockHash ?? hash(Number(sequence) + 1)
	return {
		address: FIXED_PRICE_FLOW_PROXY,
		args: {
			identity: options.identity ?? calculateSubmissionIdentity([nodeRoot]),
			length: 1n,
			sender: submitter,
			startPos: sequence,
			submission: {
				length: 100n + sequence,
				nodes: [{ height: 0n, root: nodeRoot }],
				tags: "0x",
			},
			submissionIndex: sequence,
		},
		blockHash,
		blockNumber,
		...(options.blockTimestamp === undefined ? {} : { blockTimestamp: options.blockTimestamp }),
		logIndex: Number(sequence),
		removed: options.removed ?? false,
		transactionHash: hash(Number(sequence) + 100),
		transactionIndex: 0,
	}
}

interface MutableTransport extends StorageSyncTransport {
	head: { number: bigint; hash: Hex }
	logs: SyncSubmitLog[]
	getSubmitLogs: Mock<StorageSyncTransport["getSubmitLogs"]>
	getBlock: Mock<StorageSyncTransport["getBlock"]>
}

function transport(logs: SyncSubmitLog[], headNumber: bigint): MutableTransport {
	const state = {
		head: {
			hash: logs.find((log) => log.blockNumber === headNumber)?.blockHash ?? hash(250),
			number: headNumber,
		},
		logs,
	}
	const getSubmitLogs = vi.fn<StorageSyncTransport["getSubmitLogs"]>(
		async (range: { fromBlock: bigint; toBlock: bigint }) =>
			state.logs.filter((log) => {
				const blockNumber = log.blockNumber ?? -1n
				return blockNumber >= range.fromBlock && blockNumber <= range.toBlock
			}),
	)
	const getBlock = vi.fn<StorageSyncTransport["getBlock"]>(async (blockNumber: bigint) => {
		const matchingLog = state.logs.find((log) => log.blockNumber === blockNumber)
		return {
			hash: matchingLog?.blockHash ?? state.head.hash,
			number: blockNumber,
			timestamp: 1_700_000_000n + blockNumber,
		}
	})
	return {
		get head() {
			return state.head
		},
		set head(value) {
			state.head = value
		},
		get logs() {
			return state.logs
		},
		set logs(value) {
			state.logs = value
		},
		getBlock,
		getHeadBlock: async () => state.head,
		getSubmitLogs,
		verifyDeployment: async () => ({
			beacon: FIXED_PRICE_FLOW_BEACON,
			chainId: 71,
			implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
			market: FIXED_PRICE_FLOW_MARKET,
			proxy: FIXED_PRICE_FLOW_PROXY,
		}),
	}
}

function repository(): StorageRepository {
	repositoryNumber += 1
	const instance = createStorageRepository({
		databasePrefix: `conflux-sync-test-${repositoryNumber}`,
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		normalizerVersion: "1",
		schemaVersion: 1,
	})
	repositories.push(instance)
	return instance
}

afterEach(async () => {
	await Promise.all(repositories.splice(0).map((instance) => instance.clearCurrentNamespace()))
})

describe("submission sync service", () => {
	it("starts at deployment and then refreshes a 128-block overlap", async () => {
		const instance = repository()
		const firstHead = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 300n
		const rpc = transport([makeLog(0n, FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 1n, { blockTimestamp: 10n })], firstHead)
		const service = createSubmissionSyncService({
			now: () => 1_700_000_000,
			repository: instance,
			transport: rpc,
		})

		await expect(service.sync()).resolves.toMatchObject({ status: "fresh" })
		expect(rpc.getSubmitLogs.mock.calls[0]?.[0]).toMatchObject({
			fromBlock: FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK,
		})

		rpc.head = { hash: hash(251), number: firstHead + 10n }
		await expect(service.sync()).resolves.toMatchObject({ status: "fresh" })
		expect(rpc.getSubmitLogs.mock.calls.at(-1)?.[0]).toMatchObject({
			fromBlock: firstHead - 127n,
		})
	})

	it("deduplicates out-of-order logs and fetches a missing block timestamp once per hash", async () => {
		const instance = repository()
		const blockNumber = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 2n
		const blockHash = hash(9)
		const first = makeLog(0n, blockNumber, { blockHash })
		const second = makeLog(1n, blockNumber, { blockHash })
		const rpc = transport([second, first, second], blockNumber)
		const service = createSubmissionSyncService({
			repository: instance,
			transport: rpc,
		})

		await expect(service.sync()).resolves.toMatchObject({ status: "fresh" })
		expect(rpc.getBlock).toHaveBeenCalledTimes(1)
		expect(await instance.list({ page: 1, pageSize: 20 })).toMatchObject({
			items: [expect.objectContaining({ sequence: 1n }), expect.objectContaining({ sequence: 0n })],
			totalItems: 2,
		})
	})

	it("removes an orphaned event and installs its canonical replacement", async () => {
		const instance = repository()
		const blockNumber = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 3n
		const oldLog = makeLog(0n, blockNumber, {
			blockHash: hash(10),
			blockTimestamp: 10n,
		})
		const rpc = transport([oldLog], blockNumber)
		const service = createSubmissionSyncService({
			repository: instance,
			transport: rpc,
		})
		await service.sync()
		const oldCanonicalKey = (await instance.getBySequence(0n))?.canonicalKey

		const replacement = makeLog(0n, blockNumber, {
			blockHash: hash(11),
			blockTimestamp: 11n,
		})
		rpc.logs = [{ ...oldLog, removed: true }, replacement]
		rpc.head = { hash: hash(252), number: blockNumber + 1n }
		await expect(service.sync()).resolves.toMatchObject({ status: "fresh" })

		expect(oldCanonicalKey).toBeDefined()
		expect(await instance.getByCanonicalKey(oldCanonicalKey ?? "")).toBeUndefined()
		expect(await instance.getBySequence(0n)).toMatchObject({
			blockHash: hash(11),
		})
	})

	it("returns partial without writing when a sequence gap or malformed event is found", async () => {
		const instance = repository()
		const blockNumber = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 4n
		const rpc = transport(
			[makeLog(0n, blockNumber, { blockTimestamp: 10n }), makeLog(2n, blockNumber, { blockTimestamp: 10n })],
			blockNumber,
		)
		const service = createSubmissionSyncService({
			repository: instance,
			transport: rpc,
		})

		await expect(service.sync()).resolves.toMatchObject({
			gaps: [1n],
			status: "partial",
		})
		expect((await instance.getSummary()).indexedSubmissionCount).toBe(0n)

		rpc.logs = [
			makeLog(0n, blockNumber, {
				blockTimestamp: 10n,
				identity: hash(99),
			}),
		]
		await expect(service.sync()).resolves.toMatchObject({
			status: "partial",
		})
		expect((await instance.getSummary()).indexedSubmissionCount).toBe(0n)
	})

	it("blocks writes when deployment verification detects an implementation change", async () => {
		const instance = repository()
		const rpc = transport([], FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK)
		rpc.verifyDeployment = async () => {
			throw new DeploymentVerificationError("IMPLEMENTATION_MISMATCH", "implementation changed")
		}
		const service = createSubmissionSyncService({
			repository: instance,
			transport: rpc,
		})

		await expect(service.sync()).resolves.toMatchObject({
			error: { code: "IMPLEMENTATION_MISMATCH" },
			status: "incompatible-contract",
		})
		expect((await instance.getSummary()).indexedSubmissionCount).toBe(0n)
	})

	it("distinguishes a partial batch from a stale transport failure after a prior success", async () => {
		const instance = repository()
		const blockNumber = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 5n
		const rpc = transport([makeLog(0n, blockNumber, { blockTimestamp: 10n })], blockNumber)
		const service = createSubmissionSyncService({
			now: () => 123,
			ranges: {
				initialSpan: 1n,
				jitter: () => 0,
				maximumRetries: 1,
				maximumSpan: 1n,
				minimumSpan: 1n,
				sleep: async () => {},
			},
			repository: instance,
			transport: rpc,
		})
		await expect(service.sync()).resolves.toMatchObject({ status: "fresh" })

		rpc.head = { hash: hash(253), number: blockNumber + 1n }
		rpc.getSubmitLogs.mockRejectedValueOnce(
			Object.assign(new Error("incomplete response"), {
				code: "PARTIAL_BATCH",
			}),
		)
		await expect(service.sync()).resolves.toMatchObject({
			lastSuccessAt: 123,
			status: "partial",
		})

		rpc.getSubmitLogs.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "RPC_TIMEOUT" }))
		await expect(service.sync()).resolves.toMatchObject({
			lastSuccessAt: 123,
			status: "stale",
		})
	})
})

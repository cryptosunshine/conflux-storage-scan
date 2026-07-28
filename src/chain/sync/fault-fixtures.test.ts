import type { Address, Hex } from "viem"
import { afterEach, describe, expect, it, vi } from "vitest"
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

interface FaultFixture {
	readonly schemaVersion: 1
	readonly fault: string
	readonly expectedState: "fresh" | "partial" | "incompatible-contract"
	readonly [key: string]: unknown
}

const rawFaultFixtures = import.meta.glob(
	"../../../tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/faults/v1/*.json",
	{
		eager: true,
		import: "default",
		query: "?raw",
	},
) as Readonly<Record<string, string>>

const faultFixtures = Object.entries(rawFaultFixtures)
	.map(([path, raw]) => ({
		fileName: path.split("/").at(-1) ?? path,
		fixture: JSON.parse(raw) as FaultFixture,
	}))
	.sort((left, right) => left.fileName.localeCompare(right.fileName))

const expectedFiles = [
	"429.json",
	"duplicates.json",
	"implementation-changed.json",
	"invalid-block-timestamp.json",
	"malformed-submit.json",
	"missing-enriched-fields.json",
	"out-of-order.json",
	"oversized-range.json",
	"partial-batch.json",
	"pruned-range.json",
	"removed.json",
	"reorg.json",
	"sequence-gap.json",
	"timeout.json",
	"wrong-chain.json",
]

const submitter = "0x1111111111111111111111111111111111111111" as Address
const nodeRoot = `0x${"11".repeat(32)}` as Hex
const repositories: StorageRepository[] = []
let databaseNumber = 0

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object") {
		throw new TypeError(`${label} must be an object`)
	}
	return value as Record<string, unknown>
}

function stringArray(value: unknown, label: string): readonly string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new TypeError(`${label} must be a string array`)
	}
	return value
}

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
		blockHash: options.blockHash ?? hash(Number(sequence) + 1),
		blockNumber,
		logIndex: Number(sequence),
		removed: options.removed ?? false,
		transactionHash: hash(Number(sequence) + 100),
		transactionIndex: 0,
		...(options.blockTimestamp === undefined ? {} : { blockTimestamp: options.blockTimestamp }),
	}
}

function repository(): StorageRepository {
	databaseNumber += 1
	const instance = createStorageRepository({
		databasePrefix: `conflux-fault-replay-${databaseNumber}`,
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		normalizerVersion: "1",
		schemaVersion: 1,
	})
	repositories.push(instance)
	return instance
}

function transport(options: {
	readonly logs?: readonly SyncSubmitLog[]
	readonly failure?: Error & { readonly code?: string; readonly status?: number }
	readonly deploymentFailure?: DeploymentVerificationError
	readonly blockTimestamp?: bigint
	readonly headHash?: Hex
	readonly headNumber?: bigint
}) {
	const headNumber = options.headNumber ?? FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 1n
	const logs = [...(options.logs ?? [])]
	const getBlock = vi.fn<StorageSyncTransport["getBlock"]>(async (blockNumber) => {
		const matchingLog = logs.find((log) => log.blockNumber === blockNumber)
		return {
			hash: matchingLog?.blockHash ?? options.headHash ?? hash(250),
			number: blockNumber,
			timestamp: options.blockTimestamp ?? 1_700_000_000n,
		}
	})
	const rpc = {
		getBlock,
		getHeadBlock: async () => ({
			hash: options.headHash ?? logs.find((log) => log.blockNumber === headNumber)?.blockHash ?? hash(250),
			number: headNumber,
		}),
		getSubmitLogs: async ({ fromBlock, toBlock }) => {
			if (options.failure) {
				throw options.failure
			}
			return logs.filter(
				(log) =>
					log.blockNumber !== null &&
					log.blockNumber !== undefined &&
					log.blockNumber >= fromBlock &&
					log.blockNumber <= toBlock,
			)
		},
		verifyDeployment: async () => {
			if (options.deploymentFailure) {
				throw options.deploymentFailure
			}
			return {
				beacon: FIXED_PRICE_FLOW_BEACON,
				chainId: 71 as const,
				implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
				market: FIXED_PRICE_FLOW_MARKET,
				proxy: FIXED_PRICE_FLOW_PROXY,
			}
		},
	} satisfies StorageSyncTransport
	return { getBlock, logs, rpc }
}

async function syncFixture(
	instance: StorageRepository,
	rpc: StorageSyncTransport,
): Promise<Awaited<ReturnType<ReturnType<typeof createSubmissionSyncService>["sync"]>>> {
	return createSubmissionSyncService({
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
	}).sync()
}

async function replayFixture(fixture: FaultFixture): Promise<string> {
	const instance = repository()
	const blockNumber = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + 1n

	switch (fixture.fault) {
		case "rpc-rate-limited":
		case "oversized-range":
		case "pruned-range":
		case "rpc-timeout": {
			const rpcDetails = record(fixture.rpc, `${fixture.fault}.rpc`)
			const failure = Object.assign(new Error(fixture.fault), {
				...(typeof rpcDetails.code === "string" ? { code: rpcDetails.code } : {}),
				...(typeof rpcDetails.httpStatus === "number" ? { status: rpcDetails.httpStatus } : {}),
			})
			return (await syncFixture(instance, transport({ failure }).rpc)).status
		}
		case "partial-batch":
			return (
				await syncFixture(
					instance,
					transport({
						failure: Object.assign(new Error("partial batch"), { code: "PARTIAL_BATCH" }),
					}).rpc,
				)
			).status
		case "implementation-changed": {
			const deployment = record(fixture.deployment, "implementation-changed.deployment")
			const error = new DeploymentVerificationError(
				"IMPLEMENTATION_MISMATCH",
				`implementation is ${String(deployment.actual)}; expected ${String(deployment.expected)}`,
			)
			return (await syncFixture(instance, transport({ deploymentFailure: error }).rpc)).status
		}
		case "wrong-chain": {
			const deployment = record(fixture.deployment, "wrong-chain.deployment")
			const error = new DeploymentVerificationError(
				"CHAIN_ID_MISMATCH",
				`chain is ${String(deployment.actualChainId)}; expected ${String(deployment.expectedChainId)}`,
			)
			return (await syncFixture(instance, transport({ deploymentFailure: error }).rpc)).status
		}
		case "duplicate-log": {
			const log = makeLog(0n, blockNumber, { blockTimestamp: 10n })
			const state = await syncFixture(instance, transport({ logs: [log, log] }).rpc)
			const details = record(fixture.logs, "duplicate-log.logs")
			expect((await instance.getSummary()).indexedSubmissionCount).toBe(BigInt(Number(details.expectedRecords)))
			return state.status
		}
		case "missing-enriched-log-fields": {
			const replay = transport({ logs: [makeLog(0n, blockNumber)] })
			const state = await syncFixture(instance, replay.rpc)
			const details = record(fixture.log, "missing-enriched-log-fields.log")
			expect(replay.getBlock).toHaveBeenCalledTimes(Number(details.expectedBlockFallbacks))
			return state.status
		}
		case "out-of-order-logs": {
			const details = record(fixture.logs, "out-of-order-logs.logs")
			const sequences = stringArray(details.sequences, "out-of-order-logs.logs.sequences")
			const logs = sequences.map((sequence) =>
				makeLog(BigInt(sequence), blockNumber, {
					blockHash: hash(9),
					blockTimestamp: 10n,
				}),
			)
			const state = await syncFixture(instance, transport({ logs }).rpc)
			const actual = (await instance.list({ pageSize: 20 })).items.map((item) => item.sequence.toString(10)).reverse()
			expect(actual).toEqual(details.expectedSequences)
			return state.status
		}
		case "removed-log": {
			const state = await syncFixture(
				instance,
				transport({ logs: [makeLog(0n, blockNumber, { blockTimestamp: 10n, removed: true })] }).rpc,
			)
			expect(await instance.getBySequence(0n)).toBeUndefined()
			return state.status
		}
		case "block-reorganization": {
			const details = record(fixture.blocks, "block-reorganization.blocks")
			const reorgBlock = FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK + BigInt(String(details.number))
			const oldBlockHash = String(details.oldHash) as Hex
			const newBlockHash = String(details.newHash) as Hex
			const oldLog = makeLog(0n, reorgBlock, {
				blockHash: oldBlockHash,
				blockTimestamp: 10n,
			})
			const first = transport({ headHash: oldBlockHash, headNumber: reorgBlock, logs: [oldLog] })
			await syncFixture(instance, first.rpc)
			const replacement = makeLog(0n, reorgBlock, {
				blockHash: newBlockHash,
				blockTimestamp: 11n,
			})
			const second = transport({
				headHash: newBlockHash,
				headNumber: reorgBlock,
				logs: [{ ...oldLog, removed: true }, replacement],
			})
			const state = await syncFixture(instance, second.rpc)
			expect(await instance.getBySequence(0n)).toMatchObject({ blockHash: details.newHash })
			return state.status
		}
		case "sequence-gap": {
			const details = record(fixture.logs, "sequence-gap.logs")
			const logs = stringArray(details.sequences, "sequence-gap.logs.sequences").map((sequence) =>
				makeLog(BigInt(sequence), blockNumber, { blockTimestamp: 10n }),
			)
			const state = await syncFixture(instance, transport({ logs }).rpc)
			expect(state).toMatchObject({
				gaps: stringArray(details.expectedGaps, "sequence-gap.logs.expectedGaps").map(BigInt),
			})
			return state.status
		}
		case "invalid-block-timestamp": {
			const details = record(fixture.block, "invalid-block-timestamp.block")
			const state = await syncFixture(
				instance,
				transport({
					blockTimestamp: BigInt(String(details.timestamp)),
					logs: [makeLog(0n, blockNumber)],
				}).rpc,
			)
			expect(state).toMatchObject({ error: { code: details.expectedError } })
			return state.status
		}
		case "malformed-submit": {
			const details = record(fixture.log, "malformed-submit.log")
			const state = await syncFixture(
				instance,
				transport({
					logs: [
						makeLog(0n, blockNumber, {
							blockTimestamp: 10n,
							identity: String(details.identity) as Hex,
						}),
					],
				}).rpc,
			)
			expect(state.status).toBe("partial")
			return state.status
		}
		default:
			throw new TypeError(`Fault fixture ${fixture.fault} has no replay implementation`)
	}
}

afterEach(async () => {
	await Promise.all(repositories.splice(0).map((instance) => instance.clearCurrentNamespace()))
})

describe("sync fault fixture corpus", () => {
	it("contains the complete deterministic failure corpus", () => {
		expect(faultFixtures.map(({ fileName }) => fileName)).toEqual(expectedFiles)
	})

	it.each(faultFixtures)("$fileName replays through production sync behavior", async ({ fixture }) => {
		expect(fixture.schemaVersion).toBe(1)
		await expect(replayFixture(fixture)).resolves.toBe(fixture.expectedState)
	})
})

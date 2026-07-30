import { type Address, encodeAbiParameters, encodeEventTopics, getAddress, type Hex } from "viem"
import { describe, expect, it, vi } from "vitest"
import { fixedPriceFlowAbi } from "../../chain/abi/fixed-price-flow"
import { FIXED_PRICE_FLOW_BEACON, FIXED_PRICE_FLOW_IMPLEMENTATION, FIXED_PRICE_FLOW_PROXY } from "../../chain/config"
import { calculateSubmissionIdentity } from "../../chain/normalize/submission-identity"
import { encodeStorageFileMetadata } from "../metadata/file-metadata"
import type { PreparedStorageFile } from "../sdk/prepare-file"
import { submitStorageFile } from "./submit-storage"

const account = getAddress("0x0000000000000000000000000000000000000071")
const root = `0x${"11".repeat(32)}` as Hex
const identity = calculateSubmissionIdentity([root])
const txHash = `0x${"22".repeat(32)}` as Hex
const tags = encodeStorageFileMetadata({
	name: "fixture.bin",
	type: "application/octet-stream",
})

function preparedFile(): PreparedStorageFile {
	return {
		chunkCount: 1,
		identity,
		root,
		sdkFile: {} as PreparedStorageFile["sdkFile"],
		segmentCount: 1,
		source: new File([Uint8Array.of(0)], "fixture.bin", {
			type: "application/octet-stream",
		}),
		submission: {
			data: {
				length: 1n,
				nodes: [{ height: 0n, root }],
				tags,
			},
			submitter: account,
		},
		tree: {} as PreparedStorageFile["tree"],
	}
}

function submitLog(eventIdentity: Hex = identity, eventTags: Hex = tags) {
	const topics = encodeEventTopics({
		abi: fixedPriceFlowAbi,
		args: {
			identity: eventIdentity,
			sender: account,
		},
		eventName: "Submit",
	})
	const data = encodeAbiParameters(
		[
			{ name: "submissionIndex", type: "uint256" },
			{ name: "startPos", type: "uint256" },
			{ name: "length", type: "uint256" },
			{
				components: [
					{ name: "length", type: "uint256" },
					{ name: "tags", type: "bytes" },
					{
						components: [
							{ name: "root", type: "bytes32" },
							{ name: "height", type: "uint256" },
						],
						name: "nodes",
						type: "tuple[]",
					},
				],
				name: "submission",
				type: "tuple",
			},
		],
		[
			485n,
			290_624n,
			1n,
			{
				length: 1n,
				nodes: [{ height: 0n, root }],
				tags: eventTags,
			},
		],
	)

	return {
		address: FIXED_PRICE_FLOW_PROXY,
		data,
		topics,
	}
}

function publicClient(logs = [submitLog()], status: "success" | "reverted" = "success") {
	return {
		getBytecode: vi.fn().mockResolvedValue("0x6000"),
		getChainId: vi.fn().mockResolvedValue(71),
		getStorageAt: vi.fn().mockResolvedValue(`0x${"0".repeat(24)}${FIXED_PRICE_FLOW_BEACON.slice(2).toLowerCase()}`),
		readContract: vi.fn().mockResolvedValue(FIXED_PRICE_FLOW_IMPLEMENTATION),
		waitForTransactionReceipt: vi.fn().mockResolvedValue({
			logs,
			status,
			transactionHash: txHash,
		}),
	}
}

function walletClient(chainId = 71, error?: unknown) {
	return {
		chain: { id: chainId },
		writeContract: error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(txHash),
	}
}

describe("submitStorageFile", () => {
	it("submits to the pinned proxy with zero value and returns the matching TxSeq", async () => {
		const publicRpc = publicClient()
		const wallet = walletClient()

		await expect(
			submitStorageFile({
				account,
				prepared: preparedFile(),
				publicClient: publicRpc as never,
				walletClient: wallet as never,
			}),
		).resolves.toEqual({
			txHash,
			txSeq: 485,
		})
		expect(wallet.writeContract).toHaveBeenCalledWith(
			expect.objectContaining({
				account,
				address: FIXED_PRICE_FLOW_PROXY,
				args: [preparedFile().submission],
				functionName: "submit",
				value: 0n,
			}),
		)
		expect(publicRpc.readContract).not.toHaveBeenCalledWith(expect.objectContaining({ functionName: "pricePerSector" }))
	})

	it("blocks a wallet connected to another chain", async () => {
		const wallet = walletClient(1)

		await expect(
			submitStorageFile({
				account,
				prepared: preparedFile(),
				publicClient: publicClient() as never,
				walletClient: wallet as never,
			}),
		).rejects.toMatchObject({
			code: "WRONG_WALLET_CHAIN",
		})
		expect(wallet.writeContract).not.toHaveBeenCalled()
	})

	it("maps a user-rejected wallet transaction", async () => {
		await expect(
			submitStorageFile({
				account,
				prepared: preparedFile(),
				publicClient: publicClient() as never,
				walletClient: walletClient(71, { code: 4001, message: "rejected" }) as never,
			}),
		).rejects.toMatchObject({
			code: "WALLET_REJECTED",
		})
	})

	it("rejects reverted receipts and receipts without the matching identity", async () => {
		await expect(
			submitStorageFile({
				account,
				prepared: preparedFile(),
				publicClient: publicClient([submitLog()], "reverted") as never,
				walletClient: walletClient() as never,
			}),
		).rejects.toMatchObject({
			code: "TRANSACTION_REVERTED",
		})

		await expect(
			submitStorageFile({
				account,
				prepared: preparedFile(),
				publicClient: publicClient([submitLog(`0x${"44".repeat(32)}`)]) as never,
				walletClient: walletClient() as never,
			}),
		).rejects.toMatchObject({
			code: "SUBMIT_EVENT_MISSING",
		})
	})

	it("rejects a matching identity event with different public metadata", async () => {
		await expect(
			submitStorageFile({
				account,
				prepared: preparedFile(),
				publicClient: publicClient([submitLog(identity, "0x")]) as never,
				walletClient: walletClient() as never,
			}),
		).rejects.toMatchObject({
			code: "SUBMIT_EVENT_MISSING",
		})
	})

	it("requires the connected account to equal submission.submitter", async () => {
		await expect(
			submitStorageFile({
				account: "0x0000000000000000000000000000000000000001" as Address,
				prepared: preparedFile(),
				publicClient: publicClient() as never,
				walletClient: walletClient() as never,
			}),
		).rejects.toMatchObject({
			code: "SUBMITTER_MISMATCH",
		})
	})
})

import {
	isAddressEqual,
	parseEventLogs,
	type Address,
	type Hex,
	type PublicClient,
	type WalletClient,
} from "viem"
import { fixedPriceFlowAbi } from "../../chain/abi/fixed-price-flow"
import {
	CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	FIXED_PRICE_FLOW_PROXY,
} from "../../chain/config"
import { verifyCoreDeployment } from "../../chain/proxy/verify-deployment"
import type { PreparedStorageFile } from "../sdk/prepare-file"
import { StoragePocError } from "../types"

const fixedPriceFlowSubmitAbi = [
	{
		inputs: [
			{
				components: [
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
						name: "data",
						type: "tuple",
					},
					{ name: "submitter", type: "address" },
				],
				name: "submission",
				type: "tuple",
			},
		],
		name: "submit",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
] as const

export interface SubmitStorageFileInput {
	readonly account: Address
	readonly prepared: PreparedStorageFile
	readonly publicClient: PublicClient
	readonly walletClient: WalletClient
}

export interface SubmittedStorageFile {
	readonly txHash: Hex
	readonly txSeq: number
}

function isUserRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return false
	}
	return (error as { readonly code?: unknown }).code === 4001
}

export async function submitStorageFile({
	account,
	prepared,
	publicClient,
	walletClient,
}: SubmitStorageFileInput): Promise<SubmittedStorageFile> {
	if (!isAddressEqual(account, prepared.submission.submitter)) {
		throw new StoragePocError(
			"SUBMITTER_MISMATCH",
			"Connected account must match the prepared Submission submitter",
		)
	}

	const walletChainId = walletClient.chain?.id ?? (await walletClient.getChainId())
	if (walletChainId !== CONFLUX_ESPACE_TESTNET_CHAIN_ID) {
		throw new StoragePocError(
			"WRONG_WALLET_CHAIN",
			`Wallet must be connected to chain ${CONFLUX_ESPACE_TESTNET_CHAIN_ID}`,
		)
	}
	await verifyCoreDeployment(publicClient)

	let txHash: Hex
	try {
		txHash = await walletClient.writeContract({
			abi: fixedPriceFlowSubmitAbi,
			account,
			address: FIXED_PRICE_FLOW_PROXY,
			args: [prepared.submission],
			chain: walletClient.chain,
			functionName: "submit",
			value: 0n,
		})
	} catch (cause) {
		if (isUserRejection(cause)) {
			throw new StoragePocError("WALLET_REJECTED", "Storage transaction was rejected by the user", {
				cause,
			})
		}
		throw cause
	}

	const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
	if (receipt.status !== "success") {
		throw new StoragePocError("TRANSACTION_REVERTED", "Storage transaction reverted")
	}

	const submitLogs = parseEventLogs({
		abi: fixedPriceFlowAbi,
		eventName: "Submit",
		logs: receipt.logs,
		strict: true,
	})
	const matchingLog = submitLogs.find(
		(log) =>
			log.address.toLowerCase() === FIXED_PRICE_FLOW_PROXY.toLowerCase() &&
			log.args.identity?.toLowerCase() === prepared.identity.toLowerCase(),
	)
	const submissionIndex = matchingLog?.args.submissionIndex
	if (submissionIndex === undefined || submissionIndex > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new StoragePocError(
			"SUBMIT_EVENT_MISSING",
			"Transaction receipt does not contain the prepared Submit event",
		)
	}

	return {
		txHash,
		txSeq: Number(submissionIndex),
	}
}

import { type Address, getAddress, type Hex, isAddressEqual, type PublicClient } from "viem"
import { beaconAbi } from "../abi/beacon"
import { fixedPriceFlowAbi } from "../abi/fixed-price-flow"
import {
	CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	EIP1967_BEACON_SLOT,
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../config"

export type DeploymentErrorCode =
	| "CHAIN_ID_MISMATCH"
	| "PROXY_CODE_MISSING"
	| "BEACON_MISMATCH"
	| "BEACON_CODE_MISSING"
	| "IMPLEMENTATION_MISMATCH"
	| "MARKET_MISMATCH"

export class DeploymentVerificationError extends Error {
	readonly code: DeploymentErrorCode

	constructor(code: DeploymentErrorCode, message: string) {
		super(message)
		this.name = "DeploymentVerificationError"
		this.code = code
	}
}

export interface DeploymentIdentity {
	readonly chainId: typeof CONFLUX_ESPACE_TESTNET_CHAIN_ID
	readonly proxy: Address
	readonly beacon: Address
	readonly implementation: Address
	readonly market: Address
}

export type CoreDeploymentIdentity = Omit<DeploymentIdentity, "market">

function requireCode(bytecode: Hex | undefined, code: DeploymentErrorCode, label: string): void {
	if (!bytecode || bytecode === "0x") {
		throw new DeploymentVerificationError(code, `${label} has no deployed bytecode`)
	}
}

function readBeaconAddress(storageValue: Hex | undefined): Address {
	if (!storageValue || !/^0x[0-9a-fA-F]{64}$/.test(storageValue)) {
		throw new DeploymentVerificationError("BEACON_MISMATCH", "Beacon storage slot is missing or malformed")
	}

	return getAddress(`0x${storageValue.slice(-40)}`)
}

function requireAddress(actual: Address, expected: Address, code: DeploymentErrorCode, label: string): void {
	if (!isAddressEqual(actual, expected)) {
		throw new DeploymentVerificationError(code, `${label} is ${actual}; expected ${expected}`)
	}
}

export async function verifyCoreDeployment(client: PublicClient): Promise<CoreDeploymentIdentity> {
	const chainId = await client.getChainId()
	if (chainId !== CONFLUX_ESPACE_TESTNET_CHAIN_ID) {
		throw new DeploymentVerificationError(
			"CHAIN_ID_MISMATCH",
			`Connected chain is ${chainId}; expected ${CONFLUX_ESPACE_TESTNET_CHAIN_ID}`,
		)
	}

	const proxyCode = await client.getBytecode({ address: FIXED_PRICE_FLOW_PROXY })
	requireCode(proxyCode, "PROXY_CODE_MISSING", "FixedPriceFlow proxy")

	const beaconStorage = await client.getStorageAt({
		address: FIXED_PRICE_FLOW_PROXY,
		slot: EIP1967_BEACON_SLOT,
	})
	const beacon = readBeaconAddress(beaconStorage)
	requireAddress(beacon, FIXED_PRICE_FLOW_BEACON, "BEACON_MISMATCH", "Beacon")

	const beaconCode = await client.getBytecode({ address: beacon })
	requireCode(beaconCode, "BEACON_CODE_MISSING", "FixedPriceFlow beacon")

	const implementation = await client.readContract({
		abi: beaconAbi,
		address: beacon,
		functionName: "implementation",
	})
	requireAddress(
		implementation,
		FIXED_PRICE_FLOW_IMPLEMENTATION,
		"IMPLEMENTATION_MISMATCH",
		"FixedPriceFlow implementation",
	)

	return {
		chainId: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
		proxy: FIXED_PRICE_FLOW_PROXY,
		beacon,
		implementation,
	}
}

export async function verifyDeployment(client: PublicClient): Promise<DeploymentIdentity> {
	const coreIdentity = await verifyCoreDeployment(client)
	const market = await client.readContract({
		abi: fixedPriceFlowAbi,
		address: FIXED_PRICE_FLOW_PROXY,
		functionName: "market",
	})
	requireAddress(market, FIXED_PRICE_FLOW_MARKET, "MARKET_MISMATCH", "FixedPriceFlow market")

	return {
		...coreIdentity,
		market,
	}
}

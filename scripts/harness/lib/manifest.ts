import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import {
	CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	FIXED_PRICE_FLOW_BEACON,
	FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK,
	FIXED_PRICE_FLOW_IMPLEMENTATION,
	FIXED_PRICE_FLOW_MARKET,
	FIXED_PRICE_FLOW_PROXY,
} from "../../../src/chain/config"
import { sha256File, sha256Text } from "./checksums"

export type FixtureManifestErrorCode =
	| "MANIFEST_INVALID"
	| "ABI_CHECKSUM_MISMATCH"
	| "CHECKSUM_MISMATCH"
	| "EXPECTED_COUNT_MISMATCH"

export class FixtureManifestError extends Error {
	readonly code: FixtureManifestErrorCode

	constructor(code: FixtureManifestErrorCode, message: string) {
		super(message)
		this.name = "FixtureManifestError"
		this.code = code
	}
}

export interface FixtureFileManifest {
	readonly bytes: number
	readonly sha256: string
}

export interface FixtureManifest {
	readonly schemaVersion: 1
	readonly capturedAt: string
	readonly chainId: typeof CONFLUX_ESPACE_TESTNET_CHAIN_ID
	readonly rpcEndpointType: "public-conflux-espace-testnet-json-rpc"
	readonly contract: {
		readonly proxy: string
		readonly beacon: string
		readonly implementation: string
		readonly market: string
	}
	readonly source: {
		readonly repository: "https://github.com/0gfoundation/0g-storage-contracts"
		readonly commit: "0dcef31fd6398c9aca7267dc5a7a9e1caf3a3581"
	}
	readonly abiSha256: string
	readonly normalizerVersion: "1"
	readonly deploymentBlock: string
	readonly headBlock: {
		readonly number: string
		readonly hash: string
	}
	readonly logRange: {
		readonly fromBlock: string
		readonly toBlock: string
	}
	readonly expectedSubmissions: number
	readonly featureFlags: {
		readonly blockTimestamp: boolean
		readonly transactionLogIndex: boolean
	}
	readonly files: Readonly<Record<string, FixtureFileManifest>>
}

export interface CreateFixtureManifestInput {
	readonly capturedAt: string
	readonly abiSha256: string
	readonly headBlockNumber: bigint
	readonly headBlockHash: string
	readonly logToBlock: bigint
	readonly expectedSubmissions: number
	readonly featureFlags: FixtureManifest["featureFlags"]
	readonly fileContents: Readonly<Record<string, string>>
}

export function createFixtureManifest(input: CreateFixtureManifestInput): FixtureManifest {
	const files = Object.fromEntries(
		Object.entries(input.fileContents).map(([path, contents]) => [
			path,
			{
				bytes: Buffer.byteLength(contents, "utf8"),
				sha256: sha256Text(contents),
			},
		]),
	)

	return {
		schemaVersion: 1,
		capturedAt: input.capturedAt,
		chainId: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
		rpcEndpointType: "public-conflux-espace-testnet-json-rpc",
		contract: {
			proxy: FIXED_PRICE_FLOW_PROXY,
			beacon: FIXED_PRICE_FLOW_BEACON,
			implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
			market: FIXED_PRICE_FLOW_MARKET,
		},
		source: {
			repository: "https://github.com/0gfoundation/0g-storage-contracts",
			commit: "0dcef31fd6398c9aca7267dc5a7a9e1caf3a3581",
		},
		abiSha256: input.abiSha256,
		normalizerVersion: "1",
		deploymentBlock: FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK.toString(10),
		headBlock: {
			number: input.headBlockNumber.toString(10),
			hash: input.headBlockHash,
		},
		logRange: {
			fromBlock: FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK.toString(10),
			toBlock: input.logToBlock.toString(10),
		},
		expectedSubmissions: input.expectedSubmissions,
		featureFlags: input.featureFlags,
		files,
	}
}

function assertManifest(value: unknown): asserts value is FixtureManifest {
	if (
		!value ||
		typeof value !== "object" ||
		!("schemaVersion" in value) ||
		value.schemaVersion !== 1 ||
		!("chainId" in value) ||
		value.chainId !== CONFLUX_ESPACE_TESTNET_CHAIN_ID ||
		!("rpcEndpointType" in value) ||
		value.rpcEndpointType !== "public-conflux-espace-testnet-json-rpc" ||
		!("files" in value) ||
		!value.files ||
		typeof value.files !== "object" ||
		!("expectedSubmissions" in value) ||
		typeof value.expectedSubmissions !== "number" ||
		!("abiSha256" in value) ||
		typeof value.abiSha256 !== "string" ||
		!/^[0-9a-f]{64}$/.test(value.abiSha256) ||
		!("normalizerVersion" in value) ||
		value.normalizerVersion !== "1" ||
		!("deploymentBlock" in value) ||
		value.deploymentBlock !== FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK.toString(10) ||
		!("contract" in value) ||
		!value.contract ||
		typeof value.contract !== "object" ||
		!("proxy" in value.contract) ||
		value.contract.proxy !== FIXED_PRICE_FLOW_PROXY ||
		!("beacon" in value.contract) ||
		value.contract.beacon !== FIXED_PRICE_FLOW_BEACON ||
		!("implementation" in value.contract) ||
		value.contract.implementation !== FIXED_PRICE_FLOW_IMPLEMENTATION ||
		!("market" in value.contract) ||
		value.contract.market !== FIXED_PRICE_FLOW_MARKET ||
		!("source" in value) ||
		!value.source ||
		typeof value.source !== "object" ||
		!("repository" in value.source) ||
		value.source.repository !== "https://github.com/0gfoundation/0g-storage-contracts" ||
		!("commit" in value.source) ||
		value.source.commit !== "0dcef31fd6398c9aca7267dc5a7a9e1caf3a3581"
	) {
		throw new FixtureManifestError("MANIFEST_INVALID", "Fixture manifest schema or chain identity is invalid")
	}
}

export async function validateFixtureDirectory(root: string): Promise<void> {
	let manifestValue: unknown
	try {
		manifestValue = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"))
	} catch {
		throw new FixtureManifestError("MANIFEST_INVALID", "Fixture manifest is missing or is not valid JSON")
	}
	assertManifest(manifestValue)

	const abiSourcePath = resolve("src/chain/abi/fixed-price-flow.ts")
	if ((await sha256File(abiSourcePath)) !== manifestValue.abiSha256) {
		throw new FixtureManifestError(
			"ABI_CHECKSUM_MISMATCH",
			"Fixture ABI checksum does not match src/chain/abi/fixed-price-flow.ts",
		)
	}

	for (const [relativePath, expected] of Object.entries(manifestValue.files)) {
		if (
			!expected ||
			typeof expected !== "object" ||
			!("sha256" in expected) ||
			typeof expected.sha256 !== "string" ||
			!("bytes" in expected) ||
			typeof expected.bytes !== "number"
		) {
			throw new FixtureManifestError("MANIFEST_INVALID", `Invalid checksum record for ${relativePath}`)
		}

		let contents: string
		try {
			contents = await readFile(join(root, relativePath), "utf8")
		} catch {
			throw new FixtureManifestError("CHECKSUM_MISMATCH", `Manifest file is missing: ${relativePath}`)
		}
		if (sha256Text(contents) !== expected.sha256 || Buffer.byteLength(contents, "utf8") !== expected.bytes) {
			throw new FixtureManifestError("CHECKSUM_MISMATCH", `Fixture checksum does not match: ${relativePath}`)
		}
	}

	let submissions: unknown
	try {
		submissions = JSON.parse(await readFile(join(root, "expected/submissions.json"), "utf8"))
	} catch {
		throw new FixtureManifestError("MANIFEST_INVALID", "Expected submissions file is not valid JSON")
	}
	if (!Array.isArray(submissions) || submissions.length !== manifestValue.expectedSubmissions) {
		throw new FixtureManifestError(
			"EXPECTED_COUNT_MISMATCH",
			"Expected submission count does not match expected/submissions.json",
		)
	}
}

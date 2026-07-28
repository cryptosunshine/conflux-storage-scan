import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { STORAGE_FEE_CFX } from "../../src/chain/config"
import { sha256File, stringifyFixtureJson } from "./lib/checksums"
import { nextFixtureVersion, publishFixture } from "./lib/fixture-writer"
import { createFixtureManifest, validateFixtureDirectory } from "./lib/manifest"
import { createRpcClient, type RpcCapture } from "./lib/rpc"
import { formatProbeSummary, type ProbeResult, runProbe } from "./probe"

export type CaptureErrorCode = "CAPTURE_INVARIANT_FAILED"

export class CaptureError extends Error {
	readonly code: CaptureErrorCode

	constructor(code: CaptureErrorCode, message: string) {
		super(message)
		this.name = "CaptureError"
		this.code = code
	}
}

export interface BuildFixturePayloadInput {
	readonly abiSha256: string
	readonly capturedAt: string
	readonly captures: readonly RpcCapture[]
	readonly probe: ProbeResult
}

export interface FixturePayload {
	readonly files: Readonly<Record<string, string>>
}

function assertCaptureInvariants(probe: ProbeResult): void {
	if (BigInt(probe.submissions.length) !== probe.state.submissionIndex) {
		throw new CaptureError(
			"CAPTURE_INVARIANT_FAILED",
			`Full log count ${probe.submissions.length} differs from submissionIndex ${probe.state.submissionIndex}`,
		)
	}

	const canonicalKeys = new Set(probe.submissions.map((submission) => submission.canonicalKey))
	if (canonicalKeys.size !== probe.submissions.length) {
		throw new CaptureError("CAPTURE_INVARIANT_FAILED", "Normalized submissions contain duplicate canonical keys")
	}

	const sequences = new Set(probe.submissions.map((submission) => submission.sequence.toString(10)))
	if (sequences.size !== probe.submissions.length) {
		throw new CaptureError("CAPTURE_INVARIANT_FAILED", "Normalized submissions contain duplicate sequences")
	}
	for (let sequence = 0n; sequence < probe.state.submissionIndex; sequence += 1n) {
		if (!sequences.has(sequence.toString(10))) {
			throw new CaptureError("CAPTURE_INVARIANT_FAILED", `Normalized submissions are missing sequence ${sequence}`)
		}
	}
}

export function buildFixturePayload(input: BuildFixturePayloadInput): FixturePayload {
	assertCaptureInvariants(input.probe)

	const requests = input.captures.map(({ id, method, params }) => ({
		id,
		method,
		params,
	}))
	const responses = input.captures.map(({ id, result }) => ({
		id,
		result,
	}))
	const summary = {
		chainId: input.probe.identity.chainId,
		contract: input.probe.identity,
		headBlock: input.probe.headBlock,
		state: input.probe.state,
		logCount: input.probe.rawLogs.length,
		normalizedSubmissionCount: input.probe.submissions.length,
		storageFeeCfx: STORAGE_FEE_CFX,
	}
	const fileContents = {
		"captures/requests.json": stringifyFixtureJson(requests),
		"captures/responses.json": stringifyFixtureJson(responses),
		"expected/submissions.json": stringifyFixtureJson(input.probe.submissions),
		"expected/summary.json": stringifyFixtureJson(summary),
	}
	const manifest = createFixtureManifest({
		abiSha256: input.abiSha256,
		capturedAt: input.capturedAt,
		expectedSubmissions: input.probe.submissions.length,
		featureFlags: input.probe.featureFlags,
		fileContents,
		headBlockHash: input.probe.headBlock.hash,
		headBlockNumber: input.probe.headBlock.number,
		logToBlock: input.probe.headBlock.number,
	})

	return {
		files: {
			...fileContents,
			"manifest.json": stringifyFixtureJson(manifest),
		},
	}
}

function getRpcUrl(): string {
	const rpcUrl = process.env.VITE_CONFLUX_ESPACE_RPC_URL?.trim()
	if (!rpcUrl) {
		throw new CaptureError(
			"CAPTURE_INVARIANT_FAILED",
			"VITE_CONFLUX_ESPACE_RPC_URL must be set for an explicit live capture",
		)
	}
	return rpcUrl
}

async function main(): Promise<void> {
	const projectRoot = fileURLToPath(new URL("../..", import.meta.url))
	const fixtureRoot = join(projectRoot, "tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow")
	const abiSourcePath = join(projectRoot, "src/chain/abi/fixed-price-flow.ts")
	const client = createRpcClient({ url: getRpcUrl() })
	const probe = await runProbe(client)
	process.stdout.write(`${formatProbeSummary(probe)}\n`)

	const version = await nextFixtureVersion(fixtureRoot)
	const payload = buildFixturePayload({
		abiSha256: await sha256File(abiSourcePath),
		capturedAt: new Date().toISOString(),
		captures: client.captures(),
		probe,
	})
	const publishedPath = await publishFixture(fixtureRoot, version, payload.files, validateFixtureDirectory)
	process.stdout.write(`fixture=${version} path=${publishedPath} submissions=${probe.submissions.length}\n`)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
	main().catch((error: unknown) => {
		const name = error instanceof Error ? error.name : "Error"
		const message = error instanceof Error ? error.message : "Unknown capture failure"
		process.stderr.write(`${name}: ${message}\n`)
		process.exitCode = 1
	})
}

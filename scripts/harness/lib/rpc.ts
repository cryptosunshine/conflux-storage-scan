import { toFunctionSelector } from "viem"

const ALLOWED_METHODS = new Set([
	"eth_blockNumber",
	"eth_call",
	"eth_chainId",
	"eth_getBlockByNumber",
	"eth_getCode",
	"eth_getLogs",
	"eth_getStorageAt",
])

const FORBIDDEN_METHODS = new Set(["eth_sendRawTransaction", "eth_sendTransaction"])
const PRICE_PER_SECTOR_SELECTOR = toFunctionSelector("pricePerSector()").toLowerCase()

export type RpcClientErrorCode =
	| "RPC_URL_INVALID"
	| "RPC_METHOD_FORBIDDEN"
	| "RPC_TIMEOUT"
	| "RPC_NETWORK_ERROR"
	| "RPC_HTTP_ERROR"
	| "RPC_PROTOCOL_ERROR"
	| "RPC_RESPONSE_ERROR"

export class RpcClientError extends Error {
	readonly code: RpcClientErrorCode

	constructor(code: RpcClientErrorCode, message: string) {
		super(message)
		this.name = "RpcClientError"
		this.code = code
	}
}

export interface RpcCapture {
	readonly id: number
	readonly method: string
	readonly params: readonly unknown[]
	readonly result: unknown
}

export interface HarnessRpcClient {
	request<Result>(method: string, params?: readonly unknown[]): Promise<Result>
	captures(): readonly RpcCapture[]
}

export interface CreateRpcClientOptions {
	readonly url: string
	readonly timeoutMs?: number
	readonly fetchImplementation?: typeof globalThis.fetch
}

function validateRpcUrl(value: string): string {
	if (!value.trim()) {
		throw new RpcClientError("RPC_URL_INVALID", "RPC URL must be provided explicitly")
	}

	try {
		const parsed = new URL(value)
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			throw new Error("unsupported protocol")
		}
		return parsed.toString()
	} catch {
		throw new RpcClientError("RPC_URL_INVALID", "RPC URL must be an absolute HTTP(S) URL")
	}
}

function getCallData(params: readonly unknown[]): string | undefined {
	const transaction = params[0]
	if (!transaction || typeof transaction !== "object" || !("data" in transaction)) {
		return undefined
	}
	return typeof transaction.data === "string" ? transaction.data.toLowerCase() : undefined
}

function assertReadOnlyMethod(method: string, params: readonly unknown[]): void {
	if (FORBIDDEN_METHODS.has(method) || !ALLOWED_METHODS.has(method)) {
		throw new RpcClientError("RPC_METHOD_FORBIDDEN", `Harness RPC method is not allowed: ${method}`)
	}

	const serializedParams = JSON.stringify(params).toLowerCase()
	if (
		(method === "eth_call" && getCallData(params)?.startsWith(PRICE_PER_SECTOR_SELECTOR)) ||
		serializedParams.includes("pricepersector")
	) {
		throw new RpcClientError("RPC_METHOD_FORBIDDEN", "Storage pricing calls are forbidden by product policy")
	}
}

function isJsonRpcResponse(value: unknown): value is {
	readonly id: number
	readonly jsonrpc: "2.0"
	readonly result?: unknown
	readonly error?: { readonly code?: number; readonly message?: string }
} {
	return Boolean(value && typeof value === "object" && "jsonrpc" in value && value.jsonrpc === "2.0")
}

class StrictHarnessRpcClient implements HarnessRpcClient {
	readonly #url: string
	readonly #timeoutMs: number
	readonly #fetch: typeof globalThis.fetch
	readonly #captures: RpcCapture[] = []
	#nextId = 1

	constructor(options: CreateRpcClientOptions) {
		this.#url = validateRpcUrl(options.url)
		this.#timeoutMs = options.timeoutMs ?? 20_000
		this.#fetch = options.fetchImplementation ?? globalThis.fetch
	}

	captures(): readonly RpcCapture[] {
		return this.#captures.map((capture) => ({
			...capture,
			params: [...capture.params],
		}))
	}

	async request<Result>(method: string, params: readonly unknown[] = []): Promise<Result> {
		assertReadOnlyMethod(method, params)
		const id = this.#nextId
		this.#nextId += 1

		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), this.#timeoutMs)
		let response: Response
		try {
			response = await this.#fetch(this.#url, {
				body: JSON.stringify({
					id,
					jsonrpc: "2.0",
					method,
					params,
				}),
				headers: {
					"content-type": "application/json",
				},
				method: "POST",
				signal: controller.signal,
			})
		} catch {
			if (controller.signal.aborted) {
				throw new RpcClientError("RPC_TIMEOUT", `RPC request timed out after ${this.#timeoutMs}ms`)
			}
			throw new RpcClientError("RPC_NETWORK_ERROR", "RPC network request failed")
		} finally {
			clearTimeout(timeout)
		}

		if (!response.ok) {
			throw new RpcClientError("RPC_HTTP_ERROR", `RPC returned HTTP ${response.status}`)
		}

		let payload: unknown
		try {
			payload = await response.json()
		} catch {
			throw new RpcClientError("RPC_PROTOCOL_ERROR", "RPC response was not valid JSON")
		}

		if (!isJsonRpcResponse(payload) || payload.id !== id) {
			throw new RpcClientError("RPC_PROTOCOL_ERROR", "RPC response did not match the JSON-RPC request")
		}
		if (payload.error) {
			throw new RpcClientError(
				"RPC_RESPONSE_ERROR",
				`RPC error ${payload.error.code ?? "unknown"}: ${payload.error.message ?? "unknown error"}`,
			)
		}
		if (!Object.hasOwn(payload, "result")) {
			throw new RpcClientError("RPC_PROTOCOL_ERROR", "RPC response omitted both result and error")
		}

		const result = payload.result as Result
		this.#captures.push({
			id,
			method,
			params: [...params],
			result,
		})
		return result
	}
}

export function createRpcClient(options: CreateRpcClientOptions): HarnessRpcClient {
	return new StrictHarnessRpcClient(options)
}

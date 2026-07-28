export interface BlockRange {
	readonly fromBlock: bigint
	readonly toBlock: bigint
}

export type AdaptiveRangeErrorCode = "ABORTED" | "RANGE_EXHAUSTED"

export class AdaptiveRangeError extends Error {
	readonly code: AdaptiveRangeErrorCode
	readonly fromBlock: bigint
	readonly toBlock: bigint

	constructor(code: AdaptiveRangeErrorCode, message: string, range: BlockRange, options?: ErrorOptions) {
		super(message, options)
		this.name = "AdaptiveRangeError"
		this.code = code
		this.fromBlock = range.fromBlock
		this.toBlock = range.toBlock
	}
}

export interface ScanAdaptiveRangesOptions<Result> {
	readonly fromBlock: bigint
	readonly toBlock: bigint
	readonly minimumSpan: bigint
	readonly initialSpan: bigint
	readonly maximumSpan: bigint
	readonly maximumRetries?: number
	readonly baseRetryDelayMs?: number
	readonly signal?: AbortSignal
	readonly jitter?: (baseDelayMs: number) => number
	readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
	readonly fetchRange: (range: BlockRange, signal?: AbortSignal) => Promise<readonly Result[]>
}

function errorProperty(error: unknown, property: string): unknown {
	return error && typeof error === "object" && property in error ? error[property as keyof typeof error] : undefined
}

function isRetryableRangeFailure(error: unknown): boolean {
	const code = errorProperty(error, "code")
	const status = errorProperty(error, "status")
	const name = errorProperty(error, "name")
	const message = error instanceof Error ? error.message.toLowerCase() : ""
	return (
		status === 429 ||
		["RPC_RATE_LIMITED", "RPC_TIMEOUT", "RESPONSE_TOO_LARGE", "OVERSIZED_RANGE", "PRUNED_RANGE"].includes(
			String(code),
		) ||
		name === "TimeoutError" ||
		message.includes("response too large") ||
		message.includes("range too large")
	)
}

function assertActive(signal: AbortSignal | undefined, range: BlockRange): void {
	if (signal?.aborted) {
		throw new AdaptiveRangeError("ABORTED", "Adaptive range scan was cancelled", range)
	}
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", abort)
			resolve()
		}, milliseconds)
		const abort = () => {
			clearTimeout(timeout)
			reject(new DOMException("The operation was aborted", "AbortError"))
		}
		signal?.addEventListener("abort", abort, { once: true })
	})
}

function validateOptions<Result>(options: ScanAdaptiveRangesOptions<Result>): void {
	if (
		options.fromBlock < 0n ||
		options.toBlock < options.fromBlock ||
		options.minimumSpan < 1n ||
		options.initialSpan < options.minimumSpan ||
		options.maximumSpan < options.initialSpan
	) {
		throw new RangeError("Adaptive range configuration is invalid")
	}
}

export async function scanAdaptiveRanges<Result>(
	options: ScanAdaptiveRangesOptions<Result>,
): Promise<readonly Result[]> {
	validateOptions(options)
	const maximumRetries = options.maximumRetries ?? 3
	if (!Number.isSafeInteger(maximumRetries) || maximumRetries < 1) {
		throw new RangeError("maximumRetries must be a positive safe integer")
	}

	const baseRetryDelayMs = options.baseRetryDelayMs ?? 250
	const jitter = options.jitter ?? ((delay) => Math.floor(Math.random() * delay))
	const sleep = options.sleep ?? defaultSleep
	const results: Result[] = []
	let cursor = options.fromBlock
	let span = options.initialSpan
	let consecutiveSuccesses = 0
	let retryAttempt = 0

	while (cursor <= options.toBlock) {
		const range = {
			fromBlock: cursor,
			toBlock: cursor + span - 1n > options.toBlock ? options.toBlock : cursor + span - 1n,
		}
		assertActive(options.signal, range)

		try {
			results.push(...(await options.fetchRange(range, options.signal)))
			cursor = range.toBlock + 1n
			retryAttempt = 0
			consecutiveSuccesses += 1
			if (consecutiveSuccesses >= 2) {
				span = span * 2n > options.maximumSpan ? options.maximumSpan : span * 2n
				consecutiveSuccesses = 0
			}
		} catch (error) {
			if (options.signal?.aborted) {
				throw new AdaptiveRangeError("ABORTED", "Adaptive range scan was cancelled", range, { cause: error })
			}
			if (!isRetryableRangeFailure(error)) {
				throw error
			}

			retryAttempt += 1
			consecutiveSuccesses = 0
			if (span > options.minimumSpan) {
				const half = span / 2n
				span = half < options.minimumSpan ? options.minimumSpan : half
			} else if (retryAttempt >= maximumRetries) {
				throw new AdaptiveRangeError(
					"RANGE_EXHAUSTED",
					`RPC range ${range.fromBlock}-${range.toBlock} failed after ${retryAttempt} attempts`,
					range,
					{ cause: error },
				)
			}

			const exponentialDelay = baseRetryDelayMs * 2 ** (retryAttempt - 1)
			await sleep(exponentialDelay + Math.max(0, jitter(exponentialDelay)), options.signal)
		}
	}

	return results
}

import { getAddress, isAddress } from "viem"
import type { AnalyticsMetric, AnalyticsRange } from "../analytics/types"

const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)$/

export function normalizePage(value: unknown): number {
	const candidate = typeof value === "string" && value !== "" ? Number(value) : value
	return Number.isSafeInteger(candidate) && Number(candidate) > 0 ? Number(candidate) : 1
}

export function normalizeAnalyticsMetric(value: unknown): AnalyticsMetric {
	return value === "submissions" ? "submissions" : "storage"
}

export function normalizeAnalyticsRange(value: unknown): AnalyticsRange {
	return value === "7d" || value === "30d" ? value : "all"
}

export function parseSequenceParam(value: string): string {
	if (!UNSIGNED_DECIMAL.test(value)) {
		throw new TypeError("Submission sequence must be a non-negative integer")
	}
	return BigInt(value).toString(10)
}

export function parseAddressParam(value: string): `0x${string}` {
	const normalizedPrefix = value.startsWith("0X") ? `0x${value.slice(2)}` : value
	if (!isAddress(normalizedPrefix)) {
		throw new TypeError("Address must be a 42-character EVM address")
	}
	return getAddress(normalizedPrefix)
}

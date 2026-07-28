import type { StorageTimelinePoint } from "../../analytics/types"

const BYTE_UNITS = [
	{ divisor: 1n, label: "B" },
	{ divisor: 1_024n, label: "KiB" },
	{ divisor: 1_048_576n, label: "MiB" },
	{ divisor: 1_073_741_824n, label: "GiB" },
	{ divisor: 1_099_511_627_776n, label: "TiB" },
] as const

export interface ChartByteScale {
	readonly divisor: bigint
	readonly label: string
}

export function formatUtcDate(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	}).format(new Date(`${date}T00:00:00.000Z`))
}

export function selectChartByteScale(points: readonly StorageTimelinePoint[]): ChartByteScale {
	const maximum = points.reduce(
		(current, point) => (point.allocatedBytes > current ? point.allocatedBytes : current),
		0n,
	)
	let selected: ChartByteScale = BYTE_UNITS[0]
	for (const candidate of BYTE_UNITS) {
		if (maximum < candidate.divisor) {
			break
		}
		selected = candidate
	}
	return selected
}

export function bigintToChartNumber(value: bigint, divisor = 1n): number {
	if (divisor <= 0n) {
		throw new RangeError("Chart divisor must be positive")
	}
	const whole = Number(value / divisor)
	if (!Number.isFinite(whole)) {
		return value < 0n ? -Number.MAX_VALUE : Number.MAX_VALUE
	}
	return whole + Number(value % divisor) / Number(divisor)
}

export function formatChartTick(value: number): string {
	return new Intl.NumberFormat("en-US", {
		compactDisplay: "short",
		maximumFractionDigits: 1,
		notation: "compact",
	}).format(value)
}

export function utilizationPercent(logicalBytes: bigint, allocatedBytes: bigint): string {
	if (allocatedBytes === 0n) {
		return "0%"
	}
	const tenths = (logicalBytes * 1_000n + allocatedBytes / 2n) / allocatedBytes
	return `${tenths / 10n}.${tenths % 10n}%`
}

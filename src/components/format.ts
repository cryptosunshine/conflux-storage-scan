const IEC_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const

export function formatInteger(value: bigint | number, locale = "en-US"): string {
	return new Intl.NumberFormat(locale).format(value)
}

export function formatBytes(value: bigint, locale = "en-US"): string {
	if (value < 0n) {
		throw new RangeError("Byte value cannot be negative")
	}

	let unitIndex = 0
	let divisor = 1n
	while (unitIndex < IEC_UNITS.length - 1 && value >= divisor * 1_024n) {
		divisor *= 1_024n
		unitIndex += 1
	}

	const unit = IEC_UNITS[unitIndex]
	if (unitIndex === 0) {
		return `${formatInteger(value, locale)} ${unit}`
	}

	const tenths = (value * 10n + divisor / 2n) / divisor
	const whole = tenths / 10n
	const fraction = tenths % 10n
	return `${formatInteger(whole, locale)}${fraction === 0n ? "" : `.${fraction}`} ${unit}`
}

export function truncateMiddle(value: string, leading = 6, trailing = 4): string {
	if (value.length <= leading + trailing + 1) {
		return value
	}
	return `${value.slice(0, leading)}…${value.slice(-trailing)}`
}

export function formatRelativeTime(timestampSeconds: number, now = Date.now(), locale = "en-US"): string {
	const differenceSeconds = Math.round(timestampSeconds - now / 1_000)
	const absolute = Math.abs(differenceSeconds)
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

	if (absolute < 60) {
		return formatter.format(differenceSeconds, "second")
	}
	if (absolute < 3_600) {
		return formatter.format(Math.round(differenceSeconds / 60), "minute")
	}
	if (absolute < 86_400) {
		return formatter.format(Math.round(differenceSeconds / 3_600), "hour")
	}
	return formatter.format(Math.round(differenceSeconds / 86_400), "day")
}

export function timestampIso(timestampSeconds: number): string {
	return new Date(timestampSeconds * 1_000).toISOString()
}

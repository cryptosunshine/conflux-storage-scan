import { describe, expect, it } from "vitest"
import { formatUtcCompactDate, formatUtcDate } from "./chart-format"

describe("chart date formatting", () => {
	it("uses UTC-aware Intl formatting for full and compact axis labels", () => {
		expect(formatUtcDate("2026-06-13")).toBe("Jun 13, 2026")
		expect(formatUtcCompactDate("2026-06-13")).toBe("06-13")
		expect(formatUtcDate("2026-07-28", "zh-CN")).toBe("2026年7月28日")
		expect(formatUtcCompactDate("2026-07-28", "zh-CN")).toBe("07-28")
	})
})

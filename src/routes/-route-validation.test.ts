import { describe, expect, it } from "vitest"
import { normalizeAnalyticsMetric, normalizeAnalyticsRange } from "./-route-validation"

describe("analytics route search validation", () => {
	it("keeps supported metrics and defaults every other value to storage", () => {
		expect(normalizeAnalyticsMetric("submissions")).toBe("submissions")
		expect(normalizeAnalyticsMetric("storage")).toBe("storage")
		expect(normalizeAnalyticsMetric("other")).toBe("storage")
		expect(normalizeAnalyticsMetric(undefined)).toBe("storage")
	})

	it("keeps supported ranges and defaults every other value to all", () => {
		expect(normalizeAnalyticsRange("7d")).toBe("7d")
		expect(normalizeAnalyticsRange("30d")).toBe("30d")
		expect(normalizeAnalyticsRange("all")).toBe("all")
		expect(normalizeAnalyticsRange("90d")).toBe("all")
		expect(normalizeAnalyticsRange(undefined)).toBe("all")
	})
})

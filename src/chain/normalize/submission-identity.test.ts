import { describe, expect, it } from "vitest"
import { calculateSubmissionIdentity } from "./submission-identity"

describe("calculateSubmissionIdentity", () => {
	it("hashes packed node roots in order", () => {
		const roots = [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`] as const

		expect(calculateSubmissionIdentity(roots)).toBe(
			"0x3e92e0db88d6afea9edc4eedf62fffa4d92bcdfc310dccbe943747fe8302e871",
		)
		expect(calculateSubmissionIdentity(roots)).not.toBe(calculateSubmissionIdentity([...roots].reverse()))
	})
})

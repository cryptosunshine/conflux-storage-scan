import { describe, expect, it } from "vitest"

const faultFixtures = import.meta.glob(
	"../../../tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/faults/v1/*.json",
	{
		eager: true,
		import: "default",
		query: "?raw",
	},
) as Readonly<Record<string, string>>

const expectedFiles = [
	"429.json",
	"duplicates.json",
	"implementation-changed.json",
	"invalid-block-timestamp.json",
	"malformed-submit.json",
	"missing-enriched-fields.json",
	"out-of-order.json",
	"oversized-range.json",
	"partial-batch.json",
	"pruned-range.json",
	"removed.json",
	"reorg.json",
	"sequence-gap.json",
	"timeout.json",
	"wrong-chain.json",
]

describe("sync fault fixture corpus", () => {
	it("contains every deterministic failure scenario outside the immutable live capture", () => {
		const fileNames = Object.keys(faultFixtures)
			.map((path) => path.split("/").at(-1))
			.sort()

		expect(fileNames).toEqual(expectedFiles)
		for (const rawFixture of Object.values(faultFixtures)) {
			expect(JSON.parse(rawFixture)).toMatchObject({
				schemaVersion: 1,
				expectedState: expect.any(String),
				fault: expect.any(String),
			})
		}
	})
})

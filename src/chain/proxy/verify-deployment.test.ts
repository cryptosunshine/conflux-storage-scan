import { describe, expect, it, vi } from "vitest"
import { FIXED_PRICE_FLOW_BEACON } from "../config"
import { verifyDeployment } from "./verify-deployment"

describe("verifyDeployment", () => {
	it("blocks an unexpected implementation", async () => {
		const client = {
			getChainId: vi.fn().mockResolvedValue(71),
			getBytecode: vi.fn().mockResolvedValue("0x6000"),
			getStorageAt: vi.fn().mockResolvedValue(`0x${"0".repeat(24)}${FIXED_PRICE_FLOW_BEACON.slice(2).toLowerCase()}`),
			readContract: vi.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
		}

		await expect(verifyDeployment(client as never)).rejects.toMatchObject({
			code: "IMPLEMENTATION_MISMATCH",
		})
	})
})

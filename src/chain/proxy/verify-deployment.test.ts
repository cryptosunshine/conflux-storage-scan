import { describe, expect, it, vi } from "vitest"
import { FIXED_PRICE_FLOW_BEACON, FIXED_PRICE_FLOW_IMPLEMENTATION } from "../config"
import { verifyCoreDeployment, verifyDeployment } from "./verify-deployment"

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

	it("verifies the write-critical deployment identity without reading Market", async () => {
		const readContract = vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
			if (functionName === "implementation") {
				return Promise.resolve(FIXED_PRICE_FLOW_IMPLEMENTATION)
			}
			throw new Error(`Unexpected contract read: ${functionName}`)
		})
		const client = {
			getChainId: vi.fn().mockResolvedValue(71),
			getBytecode: vi.fn().mockResolvedValue("0x6000"),
			getStorageAt: vi
				.fn()
				.mockResolvedValue(`0x${"0".repeat(24)}${FIXED_PRICE_FLOW_BEACON.slice(2).toLowerCase()}`),
			readContract,
		}

		await expect(verifyCoreDeployment(client as never)).resolves.toEqual({
			beacon: FIXED_PRICE_FLOW_BEACON,
			chainId: 71,
			implementation: FIXED_PRICE_FLOW_IMPLEMENTATION,
			proxy: expect.any(String),
		})
		expect(readContract).toHaveBeenCalledTimes(1)
		expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "implementation" }))
	})
})

import { Blob as ZgBlob } from "@0gfoundation/0g-storage-ts-sdk/browser"
import { describe, expect, it } from "vitest"

describe("0G browser SDK", () => {
	it("builds a Merkle root from a browser File", async () => {
		const file = new File([Uint8Array.of(0)], "one-byte.bin")
		const [tree, error] = await new ZgBlob(file).merkleTree()

		expect(error).toBeNull()
		expect(tree?.rootHash()).toBe("0xd397b3b043d87fcd6fad1291ff0bfd16401c274896d8c63a923727f077b8e0b5")
	})
})

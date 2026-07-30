import { afterEach, describe, expect, it } from "vitest"
import { createStorageSessionStore, type StorageSessionStore } from "./storage-session-store"
import type { StorageUploadSession } from "./upload-session"

let databaseNumber = 0
const stores: StorageSessionStore[] = []

function store(): StorageSessionStore {
	databaseNumber += 1
	const instance = createStorageSessionStore({
		databaseName: `conflux-storage-poc-test-${databaseNumber}`,
	})
	stores.push(instance)
	return instance
}

function session(id: string, updatedAt: number): StorageUploadSession {
	return {
		account: "0x0000000000000000000000000000000000000071",
		confirmedSegmentIndexes: [0],
		createdAt: 1,
		fileName: "fixture.bin",
		fileSize: 257,
		id,
		identity: `0x${"22".repeat(32)}`,
		nodeUrl: "http://47.84.224.253:5678",
		phase: "uploading",
		root: `0x${"11".repeat(32)}`,
		schemaVersion: 1,
		totalSegments: 1,
		txHash: `0x${"33".repeat(32)}`,
		txSeq: 485,
		updatedAt,
	}
}

afterEach(async () => {
	await Promise.all(stores.splice(0).map((instance) => instance.clear()))
})

describe("StorageSessionStore", () => {
	it("persists metadata and returns the most recently updated session", async () => {
		const instance = store()
		await instance.put(session("older", 10))
		await instance.put(session("latest", 20))

		await expect(instance.getLatest()).resolves.toEqual(session("latest", 20))
	})

	it("stores no file bytes, signer, provider, or wallet object", async () => {
		const instance = store()
		await instance.put(session("safe", 10))

		const serialized = JSON.stringify(await instance.getLatest())

		expect(serialized).not.toContain("arrayBuffer")
		expect(serialized).not.toContain("privateKey")
		expect(serialized).not.toContain("provider")
		expect(serialized).not.toContain("signer")
		expect(serialized).not.toContain("wallet")
	})

	it("deletes a session without clearing other records", async () => {
		const instance = store()
		await instance.put(session("keep", 10))
		await instance.put(session("delete", 20))

		await instance.delete("delete")

		await expect(instance.get("delete")).resolves.toBeUndefined()
		await expect(instance.get("keep")).resolves.toEqual(session("keep", 10))
	})
})

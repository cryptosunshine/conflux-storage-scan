import { createConfluxPublicClient } from "../chain/client"
import { FIXED_PRICE_FLOW_IMPLEMENTATION } from "../chain/config"
import { createStorageRepository } from "../data/indexed-db/storage-db"
import { createLiveRpcDataSource, createViemStorageSyncTransport } from "../data/live-rpc-data-source"
import type { StorageDataSource } from "../data/storage-data-source"

async function createAppDataSource(): Promise<StorageDataSource> {
	if (import.meta.env.MODE === "test" && import.meta.env.VITE_DATA_SOURCE === "fixture") {
		const { createBrowserFixtureDataSource } = await import("../test/browser-fixture-data-source")
		return createBrowserFixtureDataSource()
	}

	const publicClient = createConfluxPublicClient()
	const repository = createStorageRepository({
		implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
		normalizerVersion: "1",
		schemaVersion: 1,
	})

	return createLiveRpcDataSource({
		client: publicClient,
		repository,
		transport: createViemStorageSyncTransport(publicClient),
	})
}

export const storageDataSource = await createAppDataSource()

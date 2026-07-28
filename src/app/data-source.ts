import { createConfluxPublicClient } from "../chain/client"
import { FIXED_PRICE_FLOW_IMPLEMENTATION } from "../chain/config"
import { createStorageRepository } from "../data/indexed-db/storage-db"
import { createLiveRpcDataSource, createViemStorageSyncTransport } from "../data/live-rpc-data-source"

const publicClient = createConfluxPublicClient()
const repository = createStorageRepository({
	implementationAddress: FIXED_PRICE_FLOW_IMPLEMENTATION,
	normalizerVersion: "1",
	schemaVersion: 1,
})

export const storageDataSource = createLiveRpcDataSource({
	client: publicClient,
	repository,
	transport: createViemStorageSyncTransport(publicClient),
})

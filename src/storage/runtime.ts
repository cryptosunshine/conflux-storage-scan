import type { Address } from "viem"
import { CONFLUX_STORAGE_NODE_URLS } from "./config"
import {
	downloadAndVerifyStorageFile,
	type DownloadAndVerifyStorageFileInput,
	type StorageDownloadResult,
} from "./download/download-file"
import {
	inspectStorageNodes,
	selectStorageNode,
	type HealthyStorageNode,
	type StorageNodeHealth,
} from "./node/node-pool"
import {
	HttpStorageNodeClient,
	type StorageNodeClient,
} from "./node/storage-node-client"
import { createStoragePocFixtureRuntime } from "./runtime-fixture"
import {
	prepareStorageFile,
	type PreparedStorageFile,
} from "./sdk/prepare-file"
import {
	createStorageSessionStore,
	type StorageSessionStore,
} from "./session/storage-session-store"
import {
	uploadPreparedSegments,
	type UploadPreparedSegmentsInput,
} from "./upload/upload-segments"
import {
	waitForNodeFileInfo,
	type WaitForNodeFileInfoInput,
} from "./upload/wait-for-node"
import type { StorageNodeFileInfo } from "./types"

export interface StoragePocRuntime {
	readonly sessions: StorageSessionStore
	download(
		input: DownloadAndVerifyStorageFileInput,
	): Promise<StorageDownloadResult>
	inspectNodes(
		chainHead: bigint,
		requiredTxSeq?: number,
	): Promise<readonly StorageNodeHealth[]>
	prepareFile(file: File, submitter: Address): Promise<PreparedStorageFile>
	selectNode(
		chainHead: bigint,
		requiredTxSeq?: number,
	): Promise<HealthyStorageNode>
	upload(input: UploadPreparedSegmentsInput): Promise<void>
	waitForFile(input: WaitForNodeFileInfoInput): Promise<StorageNodeFileInfo>
}

export interface CreateStoragePocRuntimeOptions {
	readonly clientFactory?: (url: string) => StorageNodeClient
	readonly fixture: boolean
	readonly sessionStore?: StorageSessionStore
}

function createLiveStoragePocRuntime({
	clientFactory = (url) => new HttpStorageNodeClient(url),
	sessionStore = createStorageSessionStore(),
}: Omit<CreateStoragePocRuntimeOptions, "fixture">): StoragePocRuntime {
	const clients = CONFLUX_STORAGE_NODE_URLS.map((url) => clientFactory(url))

	return {
		download: downloadAndVerifyStorageFile,
		inspectNodes: (chainHead, requiredTxSeq) =>
			inspectStorageNodes({
				chainHead,
				clients,
				...(requiredTxSeq === undefined ? {} : { requiredTxSeq }),
			}),
		prepareFile: prepareStorageFile,
		selectNode: (chainHead, requiredTxSeq) =>
			selectStorageNode({
				chainHead,
				clients,
				...(requiredTxSeq === undefined ? {} : { requiredTxSeq }),
			}),
		sessions: sessionStore,
		upload: uploadPreparedSegments,
		waitForFile: waitForNodeFileInfo,
	}
}

export function createStoragePocRuntime(
	options: CreateStoragePocRuntimeOptions,
): StoragePocRuntime {
	if (options.fixture) {
		return createStoragePocFixtureRuntime({
			...(options.sessionStore === undefined
				? {}
				: { sessionStore: options.sessionStore }),
		})
	}
	return createLiveStoragePocRuntime(options)
}

export const storagePocRuntime = createStoragePocRuntime({
	fixture:
		import.meta.env.MODE === "test" &&
		import.meta.env.VITE_DATA_SOURCE === "fixture",
})

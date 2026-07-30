import type { Address } from "viem"
import { resolveStorageNodeClientUrls } from "./config"
import {
	type DownloadAndVerifyStorageFileInput,
	downloadAndVerifyStorageFile,
	type StorageDownloadResult,
} from "./download/download-file"
import {
	type HealthyStorageNode,
	inspectStorageNodes,
	type StorageNodeHealth,
	selectHealthyStorageNodes,
	selectStorageNode,
} from "./node/node-pool"
import { HttpStorageNodeClient, type StorageNodeClient } from "./node/storage-node-client"
import { createStoragePocFixtureRuntime } from "./runtime-fixture"
import { type PreparedStorageFile, prepareStorageFile } from "./sdk/prepare-file"
import { createStorageSessionStore, type StorageSessionStore } from "./session/storage-session-store"
import type { StorageNodeFileInfo } from "./types"
import { type UploadPreparedSegmentsInput, uploadPreparedSegments } from "./upload/upload-segments"
import { type WaitForNodeFileInfoInput, waitForNodeFileInfo } from "./upload/wait-for-node"

export interface StoragePocRuntime {
	readonly mode: "fixture" | "live"
	readonly sessions: StorageSessionStore
	download(input: DownloadAndVerifyStorageFileInput): Promise<StorageDownloadResult>
	inspectNodes(chainHead: bigint, requiredTxSeq?: number): Promise<readonly StorageNodeHealth[]>
	prepareFile(file: File, submitter: Address): Promise<PreparedStorageFile>
	selectHealthyNodes(chainHead: bigint, requiredTxSeq?: number): Promise<readonly HealthyStorageNode[]>
	selectNode(chainHead: bigint, requiredTxSeq?: number): Promise<HealthyStorageNode>
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
	const clients = resolveStorageNodeClientUrls().map((url) => clientFactory(url))

	return {
		download: downloadAndVerifyStorageFile,
		inspectNodes: (chainHead, requiredTxSeq) =>
			inspectStorageNodes({
				chainHead,
				clients,
				...(requiredTxSeq === undefined ? {} : { requiredTxSeq }),
			}),
		mode: "live",
		prepareFile: prepareStorageFile,
		selectHealthyNodes: (chainHead, requiredTxSeq) =>
			selectHealthyStorageNodes({
				chainHead,
				clients,
				...(requiredTxSeq === undefined ? {} : { requiredTxSeq }),
			}),
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

export function createStoragePocRuntime(options: CreateStoragePocRuntimeOptions): StoragePocRuntime {
	if (options.fixture) {
		return createStoragePocFixtureRuntime({
			...(options.sessionStore === undefined ? {} : { sessionStore: options.sessionStore }),
		})
	}
	return createLiveStoragePocRuntime(options)
}

export const storagePocRuntime = createStoragePocRuntime({
	fixture: import.meta.env.MODE === "test" && import.meta.env.VITE_DATA_SOURCE === "fixture",
})

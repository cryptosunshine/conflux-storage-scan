import { type DBSchema, type IDBPDatabase, openDB } from "idb"
import type { StorageUploadSession } from "./upload-session"

const DEFAULT_DATABASE_NAME = "conflux-storage-poc-v1"

interface StorageSessionDbSchema extends DBSchema {
	sessions: {
		key: string
		value: StorageUploadSession
		indexes: {
			updatedAt: number
		}
	}
}

export interface StorageSessionStore {
	clear(): Promise<void>
	delete(id: string): Promise<void>
	get(id: string): Promise<StorageUploadSession | undefined>
	getLatest(): Promise<StorageUploadSession | undefined>
	put(session: StorageUploadSession): Promise<void>
}

export interface CreateStorageSessionStoreOptions {
	readonly databaseName?: string
}

function toPersistedSession(session: StorageUploadSession): StorageUploadSession {
	return {
		account: session.account,
		confirmedSegmentIndexes: [...session.confirmedSegmentIndexes],
		createdAt: session.createdAt,
		...(session.errorCode === undefined ? {} : { errorCode: session.errorCode }),
		fileName: session.fileName,
		fileSize: session.fileSize,
		id: session.id,
		...(session.identity === undefined ? {} : { identity: session.identity }),
		...(session.nodeUrl === undefined ? {} : { nodeUrl: session.nodeUrl }),
		phase: session.phase,
		...(session.root === undefined ? {} : { root: session.root }),
		schemaVersion: 1,
		...(session.totalSegments === undefined ? {} : { totalSegments: session.totalSegments }),
		...(session.txHash === undefined ? {} : { txHash: session.txHash }),
		...(session.txSeq === undefined ? {} : { txSeq: session.txSeq }),
		updatedAt: session.updatedAt,
	}
}

class IndexedDbStorageSessionStore implements StorageSessionStore {
	readonly #databaseName: string
	#databasePromise: Promise<IDBPDatabase<StorageSessionDbSchema>> | undefined

	constructor({ databaseName = DEFAULT_DATABASE_NAME }: CreateStorageSessionStoreOptions) {
		this.#databaseName = databaseName
	}

	#database(): Promise<IDBPDatabase<StorageSessionDbSchema>> {
		this.#databasePromise ??= openDB<StorageSessionDbSchema>(this.#databaseName, 1, {
			upgrade(database) {
				const sessions = database.createObjectStore("sessions", {
					keyPath: "id",
				})
				sessions.createIndex("updatedAt", "updatedAt")
			},
		})
		return this.#databasePromise
	}

	async put(session: StorageUploadSession): Promise<void> {
		const database = await this.#database()
		await database.put("sessions", toPersistedSession(session))
	}

	async get(id: string): Promise<StorageUploadSession | undefined> {
		const database = await this.#database()
		return database.get("sessions", id)
	}

	async getLatest(): Promise<StorageUploadSession | undefined> {
		const database = await this.#database()
		const cursor = await database.transaction("sessions").store.index("updatedAt").openCursor(null, "prev")
		return cursor?.value
	}

	async delete(id: string): Promise<void> {
		const database = await this.#database()
		await database.delete("sessions", id)
	}

	async clear(): Promise<void> {
		const database = await this.#database()
		await database.clear("sessions")
	}
}

export function createStorageSessionStore(options: CreateStorageSessionStoreOptions = {}): StorageSessionStore {
	return new IndexedDbStorageSessionStore(options)
}

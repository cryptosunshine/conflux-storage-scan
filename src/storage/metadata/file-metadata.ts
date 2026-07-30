import { type Hex, hexToBytes, isHex, size, stringToHex } from "viem"
import { StoragePocError } from "../types"

const STORAGE_FILE_METADATA_PROTOCOL = "cfx-storage-file"
const STORAGE_FILE_METADATA_VERSION = 1
const MAX_FILE_NAME_BYTES = 255
const MAX_MEDIA_TYPE_BYTES = 127
const MAX_METADATA_BYTES = 512
const PATH_SEPARATOR = /[\\/]/
const MEDIA_TYPE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/
const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", { fatal: true })

export interface StorageFileMetadata {
	readonly name: string
	readonly type?: string
}

export interface StorageDownloadMetadata {
	readonly fileName: string
	readonly mediaType: string
	readonly recovered: boolean
}

function metadataError(message: string): StoragePocError {
	return new StoragePocError("INVALID_FILE_METADATA", message)
}

function utf8Length(value: string): number {
	return encoder.encode(value).byteLength
}

function validFileNameLength(name: string): boolean {
	const length = utf8Length(name)
	return length >= 1 && length <= MAX_FILE_NAME_BYTES
}

function hasControlCharacters(value: string): boolean {
	for (const character of value) {
		const codePoint = character.codePointAt(0) ?? 0
		if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
			return true
		}
	}
	return false
}

function isPrintableAscii(value: string): boolean {
	for (const character of value) {
		const codePoint = character.codePointAt(0) ?? 0
		if (codePoint < 0x20 || codePoint > 0x7e) {
			return false
		}
	}
	return true
}

function validMediaType(type: string): boolean {
	return type.length > 0 && utf8Length(type) <= MAX_MEDIA_TYPE_BYTES && isPrintableAscii(type) && MEDIA_TYPE.test(type)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function encodeStorageFileMetadata(file: Pick<File, "name" | "type">): Hex {
	if (
		!validFileNameLength(file.name) ||
		hasControlCharacters(file.name) ||
		PATH_SEPARATOR.test(file.name) ||
		file.name === "." ||
		file.name === ".."
	) {
		throw metadataError("File name cannot be published as safe storage metadata")
	}
	if (file.type !== "" && !validMediaType(file.type)) {
		throw metadataError("File media type cannot be published as safe storage metadata")
	}

	const payload = JSON.stringify({
		protocol: STORAGE_FILE_METADATA_PROTOCOL,
		version: STORAGE_FILE_METADATA_VERSION,
		name: file.name,
		...(file.type === "" ? {} : { type: file.type }),
	})
	if (utf8Length(payload) > MAX_METADATA_BYTES) {
		throw metadataError(`File metadata exceeds ${MAX_METADATA_BYTES} bytes`)
	}
	return stringToHex(payload)
}

export function decodeStorageFileMetadata(tags: Hex): StorageFileMetadata | undefined {
	if (!isHex(tags, { strict: true }) || tags === "0x" || size(tags) > MAX_METADATA_BYTES) {
		return undefined
	}

	try {
		const payload: unknown = JSON.parse(decoder.decode(hexToBytes(tags)))
		if (
			!isRecord(payload) ||
			payload.protocol !== STORAGE_FILE_METADATA_PROTOCOL ||
			payload.version !== STORAGE_FILE_METADATA_VERSION ||
			typeof payload.name !== "string" ||
			!validFileNameLength(payload.name) ||
			hasControlCharacters(payload.name)
		) {
			return undefined
		}
		if (payload.type !== undefined && (typeof payload.type !== "string" || !validMediaType(payload.type))) {
			return undefined
		}
		return {
			name: payload.name,
			...(payload.type === undefined ? {} : { type: payload.type }),
		}
	} catch {
		return undefined
	}
}

function safeBaseName(name: string): string | undefined {
	const baseName = name.split(PATH_SEPARATOR).at(-1)
	if (
		!baseName ||
		baseName === "." ||
		baseName === ".." ||
		!validFileNameLength(baseName) ||
		hasControlCharacters(baseName)
	) {
		return undefined
	}
	return baseName
}

export function resolveStorageDownloadMetadata(tags: Hex | undefined, txSeq: number): StorageDownloadMetadata {
	const metadata = tags === undefined ? undefined : decodeStorageFileMetadata(tags)
	const fileName = metadata ? safeBaseName(metadata.name) : undefined
	if (!fileName) {
		return {
			fileName: `storage-${txSeq}.bin`,
			mediaType: "application/octet-stream",
			recovered: false,
		}
	}
	return {
		fileName,
		mediaType: metadata?.type ?? "application/octet-stream",
		recovered: true,
	}
}

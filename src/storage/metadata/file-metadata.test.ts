import { stringToHex } from "viem"
import { describe, expect, it } from "vitest"
import { decodeStorageFileMetadata, encodeStorageFileMetadata, resolveStorageDownloadMetadata } from "./file-metadata"

const pngTags =
	"0x7b2270726f746f636f6c223a226366782d73746f726167652d66696c65222c2276657273696f6e223a312c226e616d65223a22742e706e67222c2274797065223a22696d6167652f706e67227d"

describe("storage file metadata", () => {
	it("encodes a deterministic public filename and MIME payload", () => {
		expect(encodeStorageFileMetadata({ name: "t.png", type: "image/png" })).toBe(pngTags)
		expect(decodeStorageFileMetadata(pngTags)).toEqual({
			name: "t.png",
			type: "image/png",
		})
	})

	it("preserves Unicode names and omits an empty MIME", () => {
		const tags = encodeStorageFileMetadata({
			name: "测试 文件.txt",
			type: "",
		})

		expect(decodeStorageFileMetadata(tags)).toEqual({
			name: "测试 文件.txt",
		})
	})

	it("rejects invalid upload metadata before submission", () => {
		expect(() => encodeStorageFileMetadata({ name: "", type: "text/plain" })).toThrowError(
			expect.objectContaining({ code: "INVALID_FILE_METADATA" }),
		)
		expect(() => encodeStorageFileMetadata({ name: "a".repeat(256), type: "text/plain" })).toThrowError(
			expect.objectContaining({ code: "INVALID_FILE_METADATA" }),
		)
		expect(() => encodeStorageFileMetadata({ name: "../secret.txt", type: "text/plain" })).toThrowError(
			expect.objectContaining({ code: "INVALID_FILE_METADATA" }),
		)
		expect(() => encodeStorageFileMetadata({ name: "bad\u0000.txt", type: "text/plain" })).toThrowError(
			expect.objectContaining({ code: "INVALID_FILE_METADATA" }),
		)
		expect(() => encodeStorageFileMetadata({ name: "file.txt", type: "text/plain; charset=utf-8" })).toThrowError(
			expect.objectContaining({ code: "INVALID_FILE_METADATA" }),
		)
	})

	it("accepts the 255-byte filename boundary", () => {
		const name = `${"a".repeat(251)}.bin`
		const tags = encodeStorageFileMetadata({
			name,
			type: "application/octet-stream",
		})

		expect(decodeStorageFileMetadata(tags)).toEqual({
			name,
			type: "application/octet-stream",
		})
	})

	it("returns no metadata for malformed or unsupported tags", () => {
		expect(decodeStorageFileMetadata("0x")).toBeUndefined()
		expect(decodeStorageFileMetadata("0xff")).toBeUndefined()
		expect(
			decodeStorageFileMetadata(
				stringToHex(
					JSON.stringify({
						name: "future.bin",
						protocol: "cfx-storage-file",
						version: 2,
					}),
				),
			),
		).toBeUndefined()
		expect(decodeStorageFileMetadata(stringToHex('{"not":"metadata"}'))).toBeUndefined()
	})

	it("sanitizes untrusted names and falls back for old submissions", () => {
		const maliciousTags = stringToHex(
			JSON.stringify({
				name: "../../t.png",
				protocol: "cfx-storage-file",
				type: "image/png",
				version: 1,
			}),
		)

		expect(resolveStorageDownloadMetadata(maliciousTags, 487)).toEqual({
			fileName: "t.png",
			mediaType: "image/png",
			recovered: true,
		})
		expect(resolveStorageDownloadMetadata("0x", 486)).toEqual({
			fileName: "storage-486.bin",
			mediaType: "application/octet-stream",
			recovered: false,
		})
	})
})

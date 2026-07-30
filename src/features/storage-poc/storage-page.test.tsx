import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { zeroAddress, zeroHash } from "viem"
import { describe, expect, it, vi } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { STORAGE_POC_MAX_FILE_BYTES } from "../../storage/config"
import { submitStorageFile } from "../../storage/contract/submit-storage"
import { encodeStorageFileMetadata } from "../../storage/metadata/file-metadata"
import { createStoragePocFixtureRuntime } from "../../storage/runtime-fixture"
import { StoragePocError } from "../../storage/types"
import * as confirmUploadModule from "../../storage/upload/confirm-upload-on-nodes"
import { renderWithDataSource } from "../../test/render"
import { StoragePage } from "./storage-page"

vi.mock("../../storage/contract/submit-storage", () => ({
	submitStorageFile: vi.fn(),
}))

function dataSource() {
	return createFixtureDataSource({
		allocatedSectorCount: 0n,
		contractSubmissionCount: 0n,
		submissions: [],
	})
}

describe("StoragePage", () => {
	it("shows the local HTTP boundary, zero storage fee, and public controls", async () => {
		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: createStoragePocFixtureRuntime(),
		})

		expect(screen.getByRole("heading", { name: "Upload resources" })).toBeInTheDocument()
		expect(screen.getAllByText("0 CFX", { exact: true }).length).toBeGreaterThan(0)
		expect(screen.getByText(/network gas is shown separately/i)).toBeInTheDocument()
		expect(screen.getByText(/file name and type are public/i)).toBeInTheDocument()
		expect(screen.getByLabelText("TxSeq or Merkle Root")).toBeEnabled()

		await waitFor(() => {
			expect(screen.getByText("Available")).toBeInTheDocument()
			expect(screen.getByRole("button", { name: "Refresh status" })).toBeEnabled()
		})
	})

	it("prepares a valid file before asking for a wallet", async () => {
		const user = userEvent.setup()
		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: createStoragePocFixtureRuntime(),
		})

		await user.upload(
			screen.getByLabelText("Choose file"),
			new File([Uint8Array.of(0x71)], "fixture.bin", {
				type: "application/octet-stream",
			}),
		)

		expect(await screen.findByText("Merkle Root ready")).toBeInTheDocument()
		expect(screen.getAllByText(/^0x[0-9a-f]{64}$/i)).toHaveLength(2)
		expect(screen.getByRole("button", { name: "Connect wallet to continue" })).toBeEnabled()
		expect(screen.queryByText(zeroAddress)).not.toBeInTheDocument()
	})

	it("restores the selected file name after downloading its verified Root", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const file = new File([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], "t.png", {
			type: "image/png",
		})
		const prepared = await runtime.prepareFile(file, zeroAddress)
		const download = vi.spyOn(runtime, "download").mockImplementation(async (input) => {
			const downloaded = input.originalFile
				? new File([await input.originalFile.arrayBuffer()], input.originalFile.name, {
						type: input.originalFile.type,
					})
				: new File([await file.arrayBuffer()], "storage-486.bin", {
						type: "application/octet-stream",
					})
			return {
				...(input.originalFile ? { bytesEqual: true } : {}),
				file: downloaded,
				fileMetadataRecovered: input.originalFile !== undefined,
				root: prepared.root,
				txSeq: 486,
				verified: true,
			}
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await user.upload(screen.getByLabelText("Choose file"), file)
		await screen.findByText("Merkle Root ready")
		await user.type(screen.getByLabelText("TxSeq or Merkle Root"), prepared.root)
		await user.click(screen.getByRole("button", { name: "Download resource" }))

		expect(await screen.findByText(/Downloaded file: t\.png/)).toBeInTheDocument()
		expect(download).toHaveBeenCalledWith(
			expect.objectContaining({
				originalFile: file,
				target: { root: prepared.root },
			}),
		)
	})

	it("resolves public metadata from the canonical submission index", async () => {
		const user = userEvent.setup()
		const source = dataSource()
		const getSubmission = vi.spyOn(source, "getSubmission").mockResolvedValue({
			logicalSizeBytes: 4n,
			tags: encodeStorageFileMetadata({
				name: "t.png",
				type: "image/png",
			}),
		} as never)
		const runtime = createStoragePocFixtureRuntime()
		const download = vi.spyOn(runtime, "download").mockImplementation(async (input) => {
			const submission = await input.resolveSubmission?.(486)
			expect(submission?.tags).toBe(
				encodeStorageFileMetadata({
					name: "t.png",
					type: "image/png",
				}),
			)
			return {
				file: new File([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], "t.png", {
					type: "image/png",
				}),
				fileMetadataRecovered: true,
				root: `0x${"11".repeat(32)}`,
				txSeq: 486,
				verified: true,
			}
		})

		await renderWithDataSource(<StoragePage />, source, {
			storagePocRuntime: runtime,
		})
		await user.type(screen.getByLabelText("TxSeq or Merkle Root"), "486")
		await user.click(screen.getByRole("button", { name: "Download resource" }))

		expect(await screen.findByText(/Downloaded file: t\.png/)).toBeInTheDocument()
		expect(getSubmission).toHaveBeenCalledWith(486n)
		expect(download).toHaveBeenCalledWith(
			expect.objectContaining({
				resolveSubmission: expect.any(Function),
				target: { txSeq: 486 },
			}),
		)
	})

	it("distinguishes empty and over-limit files", async () => {
		const user = userEvent.setup()
		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: createStoragePocFixtureRuntime(),
		})
		const input = screen.getByLabelText("Choose file")

		await user.upload(input, new File([], "empty.bin"))
		expect(await screen.findByRole("alert")).toHaveTextContent("Choose a non-empty file")

		const oversized = new File([Uint8Array.of(0)], "oversized.bin")
		Object.defineProperty(oversized, "size", {
			value: STORAGE_POC_MAX_FILE_BYTES + 1,
		})
		await user.upload(input, oversized)
		expect(await screen.findByRole("alert")).toHaveTextContent("File must be 100 MiB or smaller")
	})

	it("shows continue upload for a recovered submitted session", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const file = new File([Uint8Array.of(0)], "recovery.bin")
		const prepared = await runtime.prepareFile(file, zeroAddress)
		await runtime.sessions.put({
			account: zeroAddress,
			confirmedSegmentIndexes: [],
			createdAt: 1,
			errorCode: "NO_HEALTHY_NODE",
			fileName: file.name,
			fileSize: file.size,
			id: "recovery-session",
			identity: prepared.identity,
			phase: "recoverable-error",
			root: prepared.root,
			schemaVersion: 1,
			totalSegments: prepared.segmentCount,
			txHash: zeroHash,
			txSeq: 485,
			updatedAt: 2,
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await user.upload(screen.getByLabelText("Choose file"), file)

		expect(screen.queryByText("On-chain submission complete")).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Continue upload" })).toBeEnabled()
	})

	it("clears pending upload notices after a verified download for the same TxSeq", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const file = new File([Uint8Array.of(0x63)], "CHANGES.txt", {
			type: "text/plain",
		})
		const prepared = await runtime.prepareFile(file, zeroAddress)
		vi.spyOn(runtime, "download").mockResolvedValue({
			bytesEqual: true,
			file: new File([await file.arrayBuffer()], file.name, { type: file.type }),
			fileMetadataRecovered: true,
			root: prepared.root,
			txSeq: 490,
			verified: true,
		})
		await runtime.sessions.put({
			account: zeroAddress,
			confirmedSegmentIndexes: [],
			createdAt: 1,
			errorCode: "UPLOAD_FAILED",
			fileName: file.name,
			fileSize: file.size,
			id: "recovery-session",
			identity: prepared.identity,
			phase: "recoverable-error",
			root: prepared.root,
			schemaVersion: 1,
			totalSegments: prepared.segmentCount,
			txHash: zeroHash,
			txSeq: 490,
			updatedAt: 2,
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await user.upload(screen.getByLabelText("Choose file"), file)
		expect(screen.queryByText("On-chain submission complete")).not.toBeInTheDocument()

		await user.type(screen.getByLabelText("TxSeq or Merkle Root"), "490")
		await user.click(screen.getByRole("button", { name: "Download resource" }))

		expect(await screen.findByText("Merkle Root verified")).toBeInTheDocument()
		expect(screen.queryByText(/TxSeq 490 is recorded on FixedPriceFlow/)).not.toBeInTheDocument()
		expect(await screen.findByText("Upload confirmed · retrieve with Merkle Root or TxSeq 490")).toBeInTheDocument()
		expect(await runtime.sessions.getLatest()).toMatchObject({
			phase: "completed",
			txSeq: 490,
		})
	})

	it("resumes a submitted session without sending a second transaction", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const file = new File([Uint8Array.of(0)], "recovery.bin")
		const prepared = await runtime.prepareFile(file, zeroAddress)
		await runtime.sessions.put({
			account: zeroAddress,
			confirmedSegmentIndexes: [],
			createdAt: 1,
			fileName: file.name,
			fileSize: file.size,
			id: "recovery-session",
			identity: prepared.identity,
			phase: "waiting-node-sync",
			root: prepared.root,
			schemaVersion: 1,
			totalSegments: prepared.segmentCount,
			txHash: zeroHash,
			txSeq: 485,
			updatedAt: 2,
		})
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: vi.fn(() => "blob:verified"),
		})
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: vi.fn(),
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await user.upload(screen.getByLabelText("Choose file"), file)
		const resume = await screen.findByRole("button", {
			name: "Continue upload",
		})
		await user.click(resume)

		expect(await screen.findByText("Merkle Root verified")).toBeInTheDocument()
		expect(await screen.findByText("Upload confirmed · retrieve with Merkle Root or TxSeq 485")).toBeInTheDocument()
		expect(screen.getByLabelText("TxSeq or Merkle Root")).toHaveValue("485")
		expect(screen.getByRole("link", { name: "Save file" })).toHaveAttribute("href", "blob:verified")
		expect(submitStorageFile).not.toHaveBeenCalled()
		expect(await runtime.sessions.getLatest()).toMatchObject({
			phase: "completed",
			txHash: zeroHash,
			txSeq: 485,
		})
	})

	it("confirms an upload after segment RPC failure without showing segment rejection copy", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const file = new File([Uint8Array.of(0x63)], "rpc-failure.bin", {
			type: "application/octet-stream",
		})
		const prepared = await runtime.prepareFile(file, zeroAddress)
		vi.spyOn(runtime, "upload").mockRejectedValue(
			new StoragePocError("UPLOAD_FAILED", "Storage Node rejected Segment 0", {
				cause: new Error("malformed upload result"),
			}),
		)
		await runtime.sessions.put({
			account: zeroAddress,
			confirmedSegmentIndexes: [],
			createdAt: 1,
			fileName: file.name,
			fileSize: file.size,
			id: "recovery-session",
			identity: prepared.identity,
			phase: "recoverable-error",
			root: prepared.root,
			schemaVersion: 1,
			totalSegments: prepared.segmentCount,
			txHash: zeroHash,
			txSeq: 491,
			updatedAt: 2,
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await user.upload(screen.getByLabelText("Choose file"), file)
		await user.click(screen.getByRole("button", { name: "Continue upload" }))

		expect(await screen.findByText("Upload confirmed · retrieve with Merkle Root or TxSeq 491")).toBeInTheDocument()
		expect(screen.queryByText(/rejected segment/i)).not.toBeInTheDocument()
		expect(await runtime.sessions.getLatest()).toMatchObject({
			phase: "completed",
			txSeq: 491,
		})
	})

	it("shows a friendly message when upload confirmation times out", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const file = new File([Uint8Array.of(0x64)], "pending.bin", {
			type: "application/octet-stream",
		})
		const prepared = await runtime.prepareFile(file, zeroAddress)
		vi.spyOn(runtime, "upload").mockRejectedValue(
			new StoragePocError("UPLOAD_FAILED", "Storage Node rejected Segment 0"),
		)
		vi.spyOn(confirmUploadModule, "confirmUploadOnHealthyNodes").mockRejectedValue(
			new StoragePocError("UPLOAD_NOT_CONFIRMED", "Storage Node did not confirm TxSeq 492 before the timeout"),
		)
		await runtime.sessions.put({
			account: zeroAddress,
			confirmedSegmentIndexes: [],
			createdAt: 1,
			fileName: file.name,
			fileSize: file.size,
			id: "recovery-session",
			identity: prepared.identity,
			phase: "recoverable-error",
			root: prepared.root,
			schemaVersion: 1,
			totalSegments: prepared.segmentCount,
			txHash: zeroHash,
			txSeq: 492,
			updatedAt: 2,
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await user.upload(screen.getByLabelText("Choose file"), file)
		await user.click(screen.getByRole("button", { name: "Continue upload" }))

		expect(
			await screen.findByText(/The Storage Node has not confirmed the upload yet|存储节点尚未确认写入/),
		).toBeInTheDocument()
		expect(screen.queryByText(/rejected segment/i)).not.toBeInTheDocument()
	})

	it("starts a new upload after choosing a different file than the recovered session", async () => {
		const user = userEvent.setup()
		const runtime = createStoragePocFixtureRuntime()
		const recoveredFile = new File([Uint8Array.of(0)], "recovery.bin")
		const recoveredPrepared = await runtime.prepareFile(recoveredFile, zeroAddress)
		await runtime.sessions.put({
			account: zeroAddress,
			confirmedSegmentIndexes: [],
			createdAt: 1,
			fileName: recoveredFile.name,
			fileSize: recoveredFile.size,
			id: "recovery-session",
			identity: recoveredPrepared.identity,
			phase: "waiting-node-sync",
			root: recoveredPrepared.root,
			schemaVersion: 1,
			totalSegments: recoveredPrepared.segmentCount,
			txHash: zeroHash,
			txSeq: 485,
			updatedAt: 2,
		})

		await renderWithDataSource(<StoragePage />, dataSource(), {
			storagePocRuntime: runtime,
		})
		await screen.findByRole("button", {
			name: "Continue upload",
		})

		await user.upload(
			screen.getByLabelText("Choose file"),
			new File([Uint8Array.of(1)], "new-file.bin", {
				type: "application/octet-stream",
			}),
		)

		expect(await screen.findByText("Merkle Root ready")).toBeInTheDocument()
		expect(screen.queryByRole("alert")).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Connect wallet to continue" })).toBeEnabled()
		await waitFor(async () => {
			expect(await runtime.sessions.get("recovery-session")).toBeUndefined()
		})
	})
})

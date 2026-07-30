import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { zeroAddress, zeroHash } from "viem"
import { describe, expect, it, vi } from "vitest"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { STORAGE_POC_MAX_FILE_BYTES } from "../../storage/config"
import { submitStorageFile } from "../../storage/contract/submit-storage"
import { encodeStorageFileMetadata } from "../../storage/metadata/file-metadata"
import { createStoragePocFixtureRuntime } from "../../storage/runtime-fixture"
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

		expect(screen.getByRole("heading", { name: "Direct Storage Node POC" })).toBeInTheDocument()
		expect(screen.getByText("Local HTTP POC")).toBeInTheDocument()
		expect(screen.getByText("0 CFX", { exact: true })).toBeInTheDocument()
		expect(screen.getByText(/network gas is separate/i)).toBeInTheDocument()
		expect(screen.getByText(/file name and type are public/i)).toBeInTheDocument()
		expect(screen.getByLabelText("TxSeq or Merkle Root")).toBeEnabled()

		await waitFor(() => {
			expect(screen.getByText("Healthy full node")).toBeInTheDocument()
			expect(screen.getByRole("button", { name: "Check nodes" })).toBeEnabled()
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
		await user.click(screen.getByRole("button", { name: "Download and verify" }))

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
		await user.click(screen.getByRole("button", { name: "Download and verify" }))

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
			name: "Resume direct upload",
		})
		await user.click(resume)

		expect(await screen.findByText("Merkle Root verified")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Save verified file" })).toHaveAttribute("href", "blob:verified")
		expect(submitStorageFile).not.toHaveBeenCalled()
		expect(await runtime.sessions.getLatest()).toMatchObject({
			phase: "completed",
			txHash: zeroHash,
			txSeq: 485,
		})
	})
})

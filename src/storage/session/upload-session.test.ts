import { describe, expect, it } from "vitest"
import { createStorageUploadSession, reduceStorageUploadSession } from "./upload-session"

const account = "0x0000000000000000000000000000000000000071"
const root = `0x${"11".repeat(32)}` as const
const identity = `0x${"22".repeat(32)}` as const
const txHash = `0x${"33".repeat(32)}` as const

describe("Storage upload session state machine", () => {
	it("moves through the transaction, node sync, upload, and verification phases", () => {
		let session = createStorageUploadSession({
			account,
			fileName: "fixture.bin",
			fileSize: 257,
			id: "session-1",
			now: 1,
		})
		session = reduceStorageUploadSession(session, {
			identity,
			root,
			totalSegments: 1,
			type: "prepared",
		})
		session = reduceStorageUploadSession(session, { type: "wallet-requested" })
		session = reduceStorageUploadSession(session, { type: "transaction-started" })
		session = reduceStorageUploadSession(session, {
			txHash,
			txSeq: 485,
			type: "transaction-confirmed",
		})
		session = reduceStorageUploadSession(session, {
			nodeUrl: "http://47.84.224.253:5678",
			type: "node-synchronized",
		})
		session = reduceStorageUploadSession(session, {
			confirmedSegmentIndexes: [0],
			type: "upload-progress",
		})
		session = reduceStorageUploadSession(session, { type: "node-verified" })
		session = reduceStorageUploadSession(session, { type: "verification-download-started" })
		session = reduceStorageUploadSession(session, { type: "completed" })

		expect(session).toMatchObject({
			confirmedSegmentIndexes: [0],
			phase: "completed",
			txHash,
			txSeq: 485,
		})
	})

	it("rejects illegal backwards transitions", () => {
		const completed = {
			...createStorageUploadSession({
				account,
				fileName: "fixture.bin",
				fileSize: 1,
				id: "session-1",
				now: 1,
			}),
			phase: "completed" as const,
		}

		expect(() => reduceStorageUploadSession(completed, { type: "transaction-started" })).toThrowError(
			/cannot transition from completed/i,
		)
	})

	it("resumes a transaction-confirmed recoverable session at node sync without resubmitting", () => {
		const errored = {
			...createStorageUploadSession({
				account,
				fileName: "fixture.bin",
				fileSize: 1,
				id: "session-1",
				now: 1,
			}),
			errorCode: "NODE_SYNC_TIMEOUT",
			identity,
			phase: "recoverable-error" as const,
			root,
			totalSegments: 1,
			txHash,
			txSeq: 485,
		}

		const resumed = reduceStorageUploadSession(errored, { type: "resume" })

		expect(resumed.phase).toBe("waiting-node-sync")
		expect(resumed.txHash).toBe(txHash)
		expect(resumed.txSeq).toBe(485)
	})
})

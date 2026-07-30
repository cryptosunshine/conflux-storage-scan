import { useCallback, useEffect, useRef, useState } from "react"
import { type Address, isHex, size, zeroAddress } from "viem"
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi"
import { useStoragePocRuntime } from "../../app/providers"
import { CONFLUX_ESPACE_TESTNET_CHAIN_ID } from "../../chain/config"
import { submitStorageFile } from "../../storage/contract/submit-storage"
import type { StorageDownloadResult } from "../../storage/download/download-file"
import type { StorageNodeHealth } from "../../storage/node/node-pool"
import type { PreparedStorageFile } from "../../storage/sdk/prepare-file"
import {
	createStorageUploadSession,
	reduceStorageUploadSession,
	type StorageUploadSession,
	type StorageUploadSessionAction,
} from "../../storage/session/upload-session"
import { StoragePocError } from "../../storage/types"
import type { StorageUploadProgress } from "../../storage/upload/upload-segments"

const FIXTURE_CHAIN_HEAD = 253_160_999n
const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)$/

export interface StoragePocUiError {
	readonly code?: string
	readonly message: string
}

function toUiError(error: unknown): StoragePocUiError {
	if (error instanceof StoragePocError) {
		return {
			code: error.code,
			message: error.message,
		}
	}
	return {
		message: error instanceof Error ? error.message : "The direct storage operation could not be completed",
	}
}

function parseDownloadTarget(value: string) {
	const normalized = value.trim()
	if (UNSIGNED_DECIMAL.test(normalized)) {
		const txSeq = Number(normalized)
		if (Number.isSafeInteger(txSeq)) {
			return { txSeq } as const
		}
	}
	if (isHex(normalized, { strict: true }) && size(normalized) === 32) {
		return { root: normalized } as const
	}
	throw new StoragePocError("INVALID_ARGUMENT", "Enter a valid TxSeq or 32-byte Merkle Root")
}

export function useStoragePoc() {
	const runtime = useStoragePocRuntime()
	const account = useAccount()
	const chainId = useChainId()
	const { switchChainAsync } = useSwitchChain()
	const publicClient = usePublicClient({
		chainId: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	})
	const walletClient = useWalletClient()
	const [file, setFile] = useState<File>()
	const [prepared, setPrepared] = useState<PreparedStorageFile>()
	const [session, setSession] = useState<StorageUploadSession>()
	const [nodeHealth, setNodeHealth] = useState<readonly StorageNodeHealth[]>()
	const [nodeChecking, setNodeChecking] = useState(false)
	const [preparing, setPreparing] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<StoragePocUiError>()
	const [uploadProgress, setUploadProgress] = useState<StorageUploadProgress>()
	const [downloadTarget, setDownloadTarget] = useState("")
	const [downloadResult, setDownloadResult] = useState<StorageDownloadResult>()
	const prepareSequence = useRef(0)
	const flowInFlight = useRef(false)

	const getChainHead = useCallback(async () => {
		if (runtime.mode === "fixture") {
			return FIXTURE_CHAIN_HEAD
		}
		if (!publicClient) {
			throw new StoragePocError("NETWORK_ERROR", "Conflux eSpace RPC client is unavailable")
		}
		return publicClient.getBlockNumber()
	}, [publicClient, runtime.mode])

	const checkNodes = useCallback(
		async (requiredTxSeq?: number) => {
			setNodeChecking(true)
			try {
				const chainHead = await getChainHead()
				const health = await runtime.inspectNodes(chainHead, requiredTxSeq)
				setNodeHealth(health)
				return health
			} catch (cause) {
				setError(toUiError(cause))
				return undefined
			} finally {
				setNodeChecking(false)
			}
		},
		[getChainHead, runtime],
	)

	useEffect(() => {
		void checkNodes()
		void runtime.sessions.getLatest().then((latest) => {
			if (latest && latest.phase !== "completed" && latest.txHash !== undefined && latest.txSeq !== undefined) {
				setSession(latest)
			}
		})
	}, [checkNodes, runtime.sessions])

	useEffect(() => {
		const hasPendingWork = prepared !== undefined && session?.phase !== "completed" && downloadResult === undefined
		if (!hasPendingWork) {
			return
		}
		const warnBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
		}
		window.addEventListener("beforeunload", warnBeforeUnload)
		return () => window.removeEventListener("beforeunload", warnBeforeUnload)
	}, [downloadResult, prepared, session?.phase])

	const selectFile = useCallback(
		async (nextFile?: File) => {
			const sequence = ++prepareSequence.current
			setFile(nextFile)
			setPrepared(undefined)
			setDownloadResult(undefined)
			setError(undefined)
			setUploadProgress(undefined)
			if (!nextFile) {
				return
			}
			setPreparing(true)
			try {
				const result = await runtime.prepareFile(nextFile, zeroAddress)
				if (prepareSequence.current !== sequence) {
					return
				}
				setPrepared(result)
				if (session?.root && session.root.toLowerCase() !== result.root.toLowerCase()) {
					setError({
						code: "INTEGRITY_MISMATCH",
						message: "The selected file does not match the recovered transaction",
					})
				}
			} catch (cause) {
				if (prepareSequence.current === sequence) {
					setError(toUiError(cause))
				}
			} finally {
				if (prepareSequence.current === sequence) {
					setPreparing(false)
				}
			}
		},
		[runtime, session?.root],
	)

	const persistTransition = useCallback(
		async (current: StorageUploadSession, action: StorageUploadSessionAction) => {
			const next = reduceStorageUploadSession(current, action)
			setSession(next)
			await runtime.sessions.put(next)
			return next
		},
		[runtime.sessions],
	)

	const finishAfterTransaction = useCallback(
		async (initialSession: StorageUploadSession, preparedFile: PreparedStorageFile) => {
			const txSeq = initialSession.txSeq
			if (txSeq === undefined) {
				throw new StoragePocError("INVALID_ARGUMENT", "Submitted session is missing TxSeq")
			}
			let working = initialSession
			if (working.phase === "recoverable-error" || working.phase === "paused") {
				working = await persistTransition(working, { type: "resume" })
			}
			const chainHead = await getChainHead()
			const selected = await runtime.selectNode(chainHead, txSeq)
			await runtime.waitForFile({
				client: selected.client,
				expectedRoot: preparedFile.root,
				expectedSize: preparedFile.source.size,
				txSeq,
			})
			working = await persistTransition(working, {
				nodeUrl: selected.client.url,
				type: "node-synchronized",
			})
			await runtime.upload({
				client: selected.client,
				onProgress: (progress) => {
					setUploadProgress(progress)
					const confirmedSegmentIndexes = Array.from({ length: progress.confirmedSegments }, (_, index) => index)
					working = reduceStorageUploadSession(working, {
						confirmedSegmentIndexes,
						type: "upload-progress",
					})
					setSession(working)
					void runtime.sessions.put(working)
				},
				prepared: preparedFile,
				txSeq,
			})
			await runtime.sessions.put(working)
			working = await persistTransition(working, {
				type: "node-verified",
			})
			working = await persistTransition(working, {
				type: "verification-download-started",
			})
			const result = await runtime.download({
				client: selected.client,
				originalFile: preparedFile.source,
				target: { txSeq },
			})
			setDownloadResult(result)
			await persistTransition(working, { type: "completed" })
			await checkNodes(txSeq)
		},
		[checkNodes, getChainHead, persistTransition, runtime],
	)

	const submitOrResume = useCallback(async () => {
		if (!prepared || !file || flowInFlight.current) {
			return
		}
		flowInFlight.current = true
		setBusy(true)
		setError(undefined)
		try {
			if (session?.txHash !== undefined && session.txSeq !== undefined) {
				if (session.root?.toLowerCase() !== prepared.root.toLowerCase()) {
					throw new StoragePocError("INTEGRITY_MISMATCH", "The selected file does not match the recovered transaction")
				}
				await finishAfterTransaction(session, prepared)
				return
			}
			if (!account.address || !account.isConnected) {
				return
			}
			if (chainId !== CONFLUX_ESPACE_TESTNET_CHAIN_ID) {
				await switchChainAsync({
					chainId: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
				})
				return
			}
			if (!publicClient || !walletClient.data) {
				throw new StoragePocError("NETWORK_ERROR", "Wallet clients are not ready")
			}
			const accountPrepared = await runtime.prepareFile(file, account.address)
			let working = createStorageUploadSession({
				account: account.address,
				fileName: file.name,
				fileSize: file.size,
				id: crypto.randomUUID(),
			})
			working = await persistTransition(working, {
				identity: accountPrepared.identity,
				root: accountPrepared.root,
				totalSegments: accountPrepared.segmentCount,
				type: "prepared",
			})
			working = await persistTransition(working, {
				type: "wallet-requested",
			})
			working = await persistTransition(working, {
				type: "transaction-started",
			})
			const submitted = await submitStorageFile({
				account: account.address as Address,
				prepared: accountPrepared,
				publicClient,
				walletClient: walletClient.data,
			})
			working = await persistTransition(working, {
				txHash: submitted.txHash,
				txSeq: submitted.txSeq,
				type: "transaction-confirmed",
			})
			await finishAfterTransaction(working, accountPrepared)
		} catch (cause) {
			setError(toUiError(cause))
			setSession((current) => {
				if (
					current &&
					[
						"awaiting-wallet",
						"transaction-pending",
						"waiting-node-sync",
						"uploading",
						"verifying-node",
						"downloading-for-verification",
					].includes(current.phase)
				) {
					const failed = reduceStorageUploadSession(current, {
						errorCode: cause instanceof StoragePocError ? cause.code : "UNKNOWN",
						type: "recoverable-error",
					})
					void runtime.sessions.put(failed)
					return failed
				}
				return current
			})
		} finally {
			flowInFlight.current = false
			setBusy(false)
		}
	}, [
		account.address,
		account.isConnected,
		chainId,
		file,
		finishAfterTransaction,
		persistTransition,
		prepared,
		publicClient,
		runtime,
		session,
		switchChainAsync,
		walletClient.data,
	])

	const download = useCallback(async () => {
		if (busy || flowInFlight.current) {
			return
		}
		flowInFlight.current = true
		setBusy(true)
		setError(undefined)
		setDownloadResult(undefined)
		try {
			const target = parseDownloadTarget(downloadTarget)
			const chainHead = await getChainHead()
			const selected = await runtime.selectNode(chainHead, "txSeq" in target ? target.txSeq : undefined)
			setDownloadResult(
				await runtime.download({
					client: selected.client,
					target,
				}),
			)
		} catch (cause) {
			setError(toUiError(cause))
		} finally {
			flowInFlight.current = false
			setBusy(false)
		}
	}, [busy, downloadTarget, getChainHead, runtime])

	return {
		account,
		busy,
		checkNodes,
		chainId,
		download,
		downloadResult,
		downloadTarget,
		error,
		file,
		nodeChecking,
		nodeHealth,
		prepared,
		preparing,
		selectFile,
		session,
		setDownloadTarget,
		submitOrResume,
		uploadProgress,
	}
}

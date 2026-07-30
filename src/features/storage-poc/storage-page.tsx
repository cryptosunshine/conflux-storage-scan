import { CheckCircle2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { DownloadPanel } from "./download-panel"
import { NodeHealthPanel } from "./node-health-panel"
import { UploadPanel } from "./upload-panel"
import { type StoragePocUiError, useStoragePoc } from "./use-storage-poc"

function uploadFailedSegment(message: string): string | undefined {
	const match = /Segment (\d+)/.exec(message)
	return match?.[1]
}

function errorMessage(error: StoragePocUiError, t: (key: string, options?: Record<string, unknown>) => string): string {
	if (error.code === "EMPTY_FILE") {
		return t("errors.empty")
	}
	if (error.code === "FILE_TOO_LARGE") {
		return t("errors.oversized")
	}
	if (error.code === "INVALID_FILE_METADATA") {
		return t("errors.metadata")
	}
	if (error.code === "INVALID_ARGUMENT") {
		return t("errors.invalidTarget")
	}
	if (error.code === "UPLOAD_FAILED") {
		const segment = uploadFailedSegment(error.message) ?? "0"
		const base = t("errors.uploadFailed", { segment })
		if (error.detail) {
			return `${base} ${t("errors.uploadFailedDetail", { detail: error.detail })}`
		}
		return base
	}
	if (error.code === "NO_HEALTHY_NODE") {
		return t("errors.noHealthyNode")
	}
	if (error.code === "NODE_SYNC_TIMEOUT") {
		return t("errors.nodeSyncTimeout")
	}
	return error.message || t("errors.unknown")
}

function errorHint(
	error: StoragePocUiError,
	t: (key: string, options?: Record<string, unknown>) => string,
	txSeq?: number,
): string | undefined {
	if (
		txSeq !== undefined &&
		(error.code === "UPLOAD_FAILED" || error.code === "NO_HEALTHY_NODE" || error.code === "NODE_SYNC_TIMEOUT")
	) {
		return t("errors.contractConfirmedRetry", { txSeq })
	}
	return undefined
}

export function StoragePage() {
	const { t } = useTranslation("storagePoc")
	const storage = useStoragePoc()
	const errorRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (storage.error) {
			errorRef.current?.focus()
		}
	}, [storage.error])
	let uploadStatus: string | undefined
	if (storage.uploadBusy) {
		if (storage.preparing) {
			uploadStatus = t("status.preparing")
		} else if (storage.session?.phase === "awaiting-wallet" || storage.session?.phase === "transaction-pending") {
			uploadStatus = t("status.submitting")
		} else if (storage.session?.phase === "waiting-node-sync") {
			uploadStatus = t("status.waiting", { txSeq: storage.session.txSeq })
		} else if (storage.session?.phase === "uploading" || storage.session?.phase === "verifying-node") {
			uploadStatus = t("status.uploading")
		} else if (storage.session?.phase === "downloading-for-verification") {
			uploadStatus = t("status.downloading")
		} else {
			uploadStatus = t("upload.processing")
		}
	}

	return (
		<section aria-labelledby="storage-page-title" className="page-section storage-page">
			<header className="page-heading storage-page__hero">
				<div>
					<p className="eyebrow">{t("page.eyebrow")}</p>
					<h1 id="storage-page-title">{t("page.title")}</h1>
					<p className="storage-page__lead">{t("page.description")}</p>
				</div>
				<div className="storage-page__fee-badge">
					<span>{t("page.feeLabel")}</span>
					<strong translate="no">0 CFX</strong>
					<p>{t("page.feeNote")}</p>
				</div>
			</header>

			{storage.error ? (
				<div className="storage-page__error" id="storage-page-error" ref={errorRef} role="alert" tabIndex={-1}>
					<div>
						<strong>{errorMessage(storage.error, t)}</strong>
						{errorHint(storage.error, t, storage.session?.txSeq) ? (
							<p>{errorHint(storage.error, t, storage.session?.txSeq)}</p>
						) : null}
					</div>
				</div>
			) : null}

			{storage.session?.phase === "completed" && storage.session.txSeq !== undefined && storage.prepared ? (
				<div className="storage-page__success" role="status">
					<div className="storage-page__success-title">
						<CheckCircle2 aria-hidden="true" size={18} />
						<strong>{t("success.title")}</strong>
					</div>
					<p>{t("success.description")}</p>
					<dl>
						<div>
							<dt>{t("success.txSeq")}</dt>
							<dd translate="no">{storage.session.txSeq}</dd>
						</div>
						<div>
							<dt>{t("success.root")}</dt>
							<dd>
								<code title={storage.prepared.root} translate="no">
									{storage.prepared.root}
								</code>
							</dd>
						</div>
					</dl>
					<p className="storage-page__success-hint">{t("success.hint")}</p>
				</div>
			) : null}

			<NodeHealthPanel
				checking={storage.nodeChecking}
				health={storage.nodeHealth}
				onCheck={() => void storage.checkNodes()}
			/>

			<section aria-labelledby="storage-workspace-title" className="storage-workspace">
				<header className="storage-workspace__header">
					<div>
						<h2 id="storage-workspace-title">{t("workspace.title")}</h2>
						<p>{t("workspace.description")}</p>
					</div>
				</header>
				<div className="storage-workspace__panels">
					<UploadPanel
						chainId={storage.chainId}
						connected={storage.account.isConnected}
						downloadResult={storage.downloadResult}
						errorCode={storage.error?.code}
						file={storage.file}
						onFile={(file) => void storage.selectFile(file)}
						onSubmit={() => void storage.submitOrResume()}
						prepared={storage.prepared}
						preparing={storage.preparing}
						session={storage.session}
						status={uploadStatus}
						uploadBusy={storage.uploadBusy}
						uploadProgress={storage.uploadProgress}
					/>
					<DownloadPanel
						downloadBusy={storage.downloadBusy}
						errorCode={storage.error?.code}
						onDownload={() => void storage.download()}
						onTarget={storage.setDownloadTarget}
						result={storage.downloadResult}
						target={storage.downloadTarget}
					/>
				</div>
			</section>
		</section>
	)
}

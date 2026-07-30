import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { DownloadPanel } from "./download-panel"
import { NodeHealthPanel } from "./node-health-panel"
import { UploadPanel } from "./upload-panel"
import { type StoragePocUiError, useStoragePoc } from "./use-storage-poc"

function errorMessage(error: StoragePocUiError, t: (key: string) => string): string {
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
	return error.message || t("errors.unknown")
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
	let status: string | undefined
	if (storage.preparing) {
		status = t("status.preparing")
	} else if (storage.session?.phase === "waiting-node-sync") {
		status = t("status.waiting", { txSeq: storage.session.txSeq })
	} else if (storage.session?.phase === "uploading") {
		status = t("status.uploading")
	} else if (storage.session?.phase === "downloading-for-verification") {
		status = t("status.downloading")
	} else if (storage.session?.phase === "completed") {
		status = t("status.completed")
	} else if (storage.session?.txHash !== undefined && !storage.downloadResult) {
		status = t("status.recovered")
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
					<strong>{errorMessage(storage.error, t)}</strong>
					{storage.error.code ? <code>{storage.error.code}</code> : null}
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
						busy={storage.busy}
						chainId={storage.chainId}
						connected={storage.account.isConnected}
						errorCode={storage.error?.code}
						file={storage.file}
						onFile={(file) => void storage.selectFile(file)}
						onSubmit={() => void storage.submitOrResume()}
						prepared={storage.prepared}
						preparing={storage.preparing}
						session={storage.session}
						status={status}
						uploadProgress={storage.uploadProgress}
					/>
					<DownloadPanel
						busy={storage.busy}
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

import { AlertTriangle } from "lucide-react"
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
	const usesProxy = globalThis.location?.protocol === "https:"
	const warningTitle = usesProxy ? t("warning.titleProxy") : t("warning.titleDirect")
	const warningDescription = usesProxy ? t("warning.descriptionProxy") : t("warning.descriptionDirect")
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
		<section aria-labelledby="storage-poc-title" className="page-section storage-poc">
			<header className="page-heading storage-poc__page-heading">
				<div>
					<p className="eyebrow">{t("page.eyebrow")}</p>
					<h1 id="storage-poc-title">{t("page.title")}</h1>
				</div>
				<p>{t("page.description")}</p>
			</header>

			<div className="storage-poc__warning" role="note">
				<AlertTriangle aria-hidden="true" size={18} />
				<div>
					<strong>{warningTitle}</strong>
					<p>{warningDescription}</p>
				</div>
			</div>

			{storage.error ? (
				<div className="storage-poc__error" id="storage-poc-error" ref={errorRef} role="alert" tabIndex={-1}>
					<strong>{errorMessage(storage.error, t)}</strong>
					{storage.error.code ? <code>{storage.error.code}</code> : null}
				</div>
			) : null}

			<NodeHealthPanel
				checking={storage.nodeChecking}
				health={storage.nodeHealth}
				onCheck={() => void storage.checkNodes()}
			/>

			<div className="storage-poc__operations">
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
	)
}

import { CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { formatBytes } from "../../components/format"
import type { StorageDownloadResult } from "../../storage/download/download-file"

export interface DownloadPanelProps {
	readonly busy: boolean
	readonly errorCode?: string
	readonly onDownload: () => void
	readonly onTarget: (value: string) => void
	readonly result?: StorageDownloadResult
	readonly target: string
}

export function DownloadPanel({ busy, errorCode, onDownload, onTarget, result, target }: DownloadPanelProps) {
	const { i18n, t } = useTranslation("storagePoc")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const [objectUrl, setObjectUrl] = useState<string>()

	useEffect(() => {
		if (!result || typeof URL.createObjectURL !== "function") {
			setObjectUrl(undefined)
			return
		}
		const url = URL.createObjectURL(result.file)
		setObjectUrl(url)
		return () => URL.revokeObjectURL(url)
	}, [result])

	return (
		<div className="storage-workspace__panel storage-workspace__panel--download">
			<header className="storage-workspace__panel-heading">
				<span aria-hidden="true" className="storage-workspace__panel-step">
					2
				</span>
				<div>
					<h3 id="storage-download-title">{t("download.title")}</h3>
					<p>{t("download.description")}</p>
				</div>
			</header>
			<div className="storage-workspace__panel-body">
				<div className="storage-download-input">
					<label htmlFor="storage-page-download-target">{t("download.inputLabel")}</label>
					<input
						aria-describedby="storage-page-download-hint"
						aria-errormessage={errorCode === "INVALID_ARGUMENT" ? "storage-page-error" : undefined}
						aria-invalid={errorCode === "INVALID_ARGUMENT"}
						autoComplete="off"
						disabled={busy}
						id="storage-page-download-target"
						inputMode="text"
						name="storageDownloadTarget"
						onChange={(event) => onTarget(event.target.value)}
						placeholder="485 or 0x…"
						spellCheck={false}
						type="text"
						value={target}
					/>
					<small id="storage-page-download-hint">{t("download.inputHint")}</small>
				</div>
				<button
					className="primary-button storage-page__primary-action"
					disabled={busy || target.trim() === ""}
					onClick={onDownload}
					type="button"
				>
					{t("download.action")}
				</button>
			</div>
			{result ? (
				<div className="storage-page__download-result" role="status">
					<div className="storage-page__success-title">
						<CheckCircle2 aria-hidden="true" size={17} />
						<strong>{t("download.verified")}</strong>
					</div>
					<p>
						{t("download.name")}: {result.file.name} · {formatBytes(BigInt(result.file.size), locale)}
					</p>
					{result.fileMetadataRecovered ? null : <p>{t("download.metadataFallback")}</p>}
					<code translate="no">{result.root}</code>
					{objectUrl ? (
						<a className="secondary-button" download={result.file.name} href={objectUrl}>
							{t("download.save")}
						</a>
					) : null}
				</div>
			) : null}
		</div>
	)
}

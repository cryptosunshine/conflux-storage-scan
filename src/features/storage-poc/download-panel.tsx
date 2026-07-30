import { CheckCircle2, Download } from "lucide-react"
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
		<section aria-labelledby="storage-download-title" className="storage-poc__operation">
			<header className="storage-poc__operation-heading">
				<span aria-hidden="true">
					<Download size={18} />
				</span>
				<div>
					<h2 id="storage-download-title">{t("download.title")}</h2>
					<p>{t("download.description")}</p>
				</div>
			</header>
			<div className="storage-download-input">
				<label htmlFor="storage-poc-download-target">{t("download.inputLabel")}</label>
				<input
					aria-describedby="storage-poc-download-hint"
					aria-errormessage={errorCode === "INVALID_ARGUMENT" ? "storage-poc-error" : undefined}
					aria-invalid={errorCode === "INVALID_ARGUMENT"}
					autoComplete="off"
					disabled={busy}
					id="storage-poc-download-target"
					inputMode="text"
					name="storageDownloadTarget"
					onChange={(event) => onTarget(event.target.value)}
					placeholder="485 or 0x…"
					spellCheck={false}
					type="text"
					value={target}
				/>
				<small id="storage-poc-download-hint">{t("download.inputHint")}</small>
			</div>
			<button
				className="primary-button storage-poc__primary-action"
				disabled={busy || target.trim() === ""}
				onClick={onDownload}
				type="button"
			>
				{t("download.action")}
			</button>
			{result ? (
				<div className="storage-poc__download-result" role="status">
					<div className="storage-poc__success-title">
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
		</section>
	)
}

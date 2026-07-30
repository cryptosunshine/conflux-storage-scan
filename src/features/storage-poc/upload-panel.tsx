import { ConnectButton } from "@rainbow-me/rainbowkit"
import { CheckCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatBytes } from "../../components/format"
import type { PreparedStorageFile } from "../../storage/sdk/prepare-file"
import type { StorageUploadSession } from "../../storage/session/upload-session"
import type { StorageUploadProgress } from "../../storage/upload/upload-segments"

export interface UploadPanelProps {
	readonly busy: boolean
	readonly chainId: number
	readonly connected: boolean
	readonly errorCode?: string
	readonly file?: File
	readonly onFile: (file?: File) => void
	readonly onSubmit: () => void
	readonly prepared?: PreparedStorageFile
	readonly preparing: boolean
	readonly session?: StorageUploadSession
	readonly status?: string
	readonly uploadProgress?: StorageUploadProgress
}

export function UploadPanel({
	busy,
	chainId,
	connected,
	errorCode,
	file,
	onFile,
	onSubmit,
	prepared,
	preparing,
	session,
	status,
	uploadProgress,
}: UploadPanelProps) {
	const { i18n, t } = useTranslation("storagePoc")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const resumesSubmittedSession = session?.txHash !== undefined && session.txSeq !== undefined
	const wrongNetwork = connected && chainId !== 71
	const fileInvalid =
		errorCode === "EMPTY_FILE" ||
		errorCode === "FILE_TOO_LARGE" ||
		errorCode === "INTEGRITY_MISMATCH" ||
		errorCode === "INVALID_FILE_METADATA"

	return (
		<div className="storage-workspace__panel storage-workspace__panel--upload">
			<header className="storage-workspace__panel-heading">
				<span aria-hidden="true" className="storage-workspace__panel-step">
					1
				</span>
				<div>
					<h3 id="storage-upload-title">{t("upload.title")}</h3>
					<p>{t("upload.description")}</p>
				</div>
			</header>

			<div className="storage-workspace__panel-body">
				<div className="storage-file-input">
					<label htmlFor="storage-page-file">{t("upload.choose")}</label>
					<input
						aria-describedby="storage-page-file-hint"
						aria-errormessage={fileInvalid ? "storage-page-error" : undefined}
						aria-invalid={fileInvalid}
						disabled={busy || preparing}
						id="storage-page-file"
						name="storageFile"
						onChange={(event) => onFile(event.target.files?.[0])}
						type="file"
					/>
					<small id="storage-page-file-hint">{t("upload.fileHint")}</small>
				</div>

				{file ? (
					<p className="storage-page__selected">
						{t("upload.selected", {
							name: file.name,
							size: formatBytes(BigInt(file.size), locale),
						})}
					</p>
				) : null}

				{prepared ? (
					<div className="storage-page__prepared" role="status">
						<div className="storage-page__success-title">
							<CheckCircle2 aria-hidden="true" size={17} />
							<strong>{t("status.ready")}</strong>
						</div>
						<dl>
							<div>
								<dt>{t("upload.root")}</dt>
								<dd>
									<code title={prepared.root} translate="no">
										{prepared.root}
									</code>
								</dd>
							</div>
							<div>
								<dt>{t("upload.identity")}</dt>
								<dd>
									<code title={prepared.identity} translate="no">
										{prepared.identity}
									</code>
								</dd>
							</div>
						</dl>
					</div>
				) : null}

				<div className="storage-page__fee">
					<div>
						<span>{t("upload.fee")}</span>
						<strong translate="no">0 CFX</strong>
					</div>
					<p>{t("upload.gas")}</p>
				</div>

				{uploadProgress ? (
					<div className="storage-page__progress" role="status">
						<progress max={uploadProgress.totalSegments} value={uploadProgress.confirmedSegments} />
						<span>
							{t("upload.progress", {
								confirmed: uploadProgress.confirmedSegments,
								total: uploadProgress.totalSegments,
							})}
						</span>
					</div>
				) : null}

				{status ? (
					<p aria-live="polite" className="storage-page__phase" role="status">
						{status}
					</p>
				) : null}

				{prepared && !connected && !resumesSubmittedSession ? (
					<ConnectButton.Custom>
						{({ openConnectModal }) => (
							<button className="primary-button storage-page__primary-action" onClick={openConnectModal} type="button">
								{t("upload.connect")}
							</button>
						)}
					</ConnectButton.Custom>
				) : (
					<button
						className="primary-button storage-page__primary-action"
						disabled={!prepared || busy || preparing}
						onClick={onSubmit}
						type="button"
					>
						{resumesSubmittedSession
							? t("upload.resume")
							: wrongNetwork
								? t("upload.switchNetwork")
								: t("upload.action")}
					</button>
				)}
			</div>
		</div>
	)
}

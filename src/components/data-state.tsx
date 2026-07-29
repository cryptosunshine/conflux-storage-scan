import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { SyncState } from "../chain/sync/sync-submissions"

export interface DataStateProps {
	readonly state: SyncState
	readonly onRetry?: () => void
	readonly recoveryAction?: ReactNode
}

function LastSynced({ value }: { readonly value: number }) {
	const { i18n, t } = useTranslation("common")
	const date = new Date(value)
	return (
		<span>
			{t("sync.lastSynced")}{" "}
			<time dateTime={date.toISOString()}>{date.toLocaleString(i18n.resolvedLanguage ?? i18n.language)}</time>
		</span>
	)
}

export function DataState({ state, onRetry, recoveryAction }: DataStateProps) {
	const { i18n, t } = useTranslation(["common", "errors"])
	const errorMessage =
		state.status === "idle" || state.status === "fresh" || state.status === "syncing"
			? undefined
			: t("codeSuffix", {
					code: state.error.code,
					message: i18n.exists(`codes.${state.error.code}`, { ns: "errors" })
						? t(`codes.${state.error.code}`, { ns: "errors" })
						: t("codes.unknown", { ns: "errors" }),
					ns: "errors",
				})
	if (state.status === "idle" || state.status === "fresh") {
		return null
	}

	if (state.status === "syncing") {
		return (
			<div aria-live="polite" className="data-notice data-notice--info">
				<div>
					<strong>{t("sync.indexing")}</strong>
					<p>
						{t("sync.readingBlocks", {
							fromBlock: state.fromBlock.toString(),
							toBlock: state.toBlock.toString(),
						})}
					</p>
				</div>
			</div>
		)
	}

	if (state.status === "incompatible-contract") {
		return (
			<div className="data-notice data-notice--blocking" role="alert">
				<div>
					<strong>
						{state.error.code === "CHAIN_ID_MISMATCH" ? t("sync.wrongNetwork") : t("sync.contractUpdate")}
					</strong>
					<p>{errorMessage}</p>
					{state.error.code === "CHAIN_ID_MISMATCH" ? null : <p>{t("sync.logsPaused")}</p>}
				</div>
			</div>
		)
	}

	if (state.status === "partial") {
		return (
			<div className="data-notice data-notice--warning" role="status">
				<div>
					<strong>
						{state.error.code === "CACHE_CORRUPT" ? t("sync.localIndexRebuild") : t("sync.dataIncomplete")}
					</strong>
					<p>{errorMessage}</p>
					{state.lastSuccessAt === undefined ? null : (
						<small>
							<LastSynced value={state.lastSuccessAt} />
						</small>
					)}
				</div>
				{state.error.code === "CACHE_CORRUPT" && recoveryAction ? (
					recoveryAction
				) : onRetry ? (
					<button className="secondary-button" onClick={onRetry} type="button">
						{t("actions.retry")}
					</button>
				) : null}
			</div>
		)
	}

	return (
		<div className="data-notice data-notice--warning" role="status">
			<div>
				<strong>{t("sync.showingCached")}</strong>
				<p>{errorMessage}</p>
				<small>
					<LastSynced value={state.lastSuccessAt} />
				</small>
			</div>
			{onRetry ? (
				<button className="secondary-button" onClick={onRetry} type="button">
					{t("actions.retry")}
				</button>
			) : null}
		</div>
	)
}

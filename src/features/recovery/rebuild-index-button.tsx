import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useStorageDataSource } from "../../app/providers"
import { storageKeys } from "../../data/queries"

export function RebuildIndexButton() {
	const { t } = useTranslation(["common", "errors"])
	const dataSource = useStorageDataSource()
	const queryClient = useQueryClient()
	const [isConfirming, setIsConfirming] = useState(false)
	const [isRebuilding, setIsRebuilding] = useState(false)
	const [error, setError] = useState<string>()

	if (!isConfirming) {
		return (
			<button className="secondary-button" onClick={() => setIsConfirming(true)} type="button">
				{t("actions.rebuildLocalIndex")}
			</button>
		)
	}

	async function rebuild() {
		setError(undefined)
		setIsRebuilding(true)
		try {
			await dataSource.rebuildLocalIndex()
			await dataSource.sync()
			await queryClient.invalidateQueries({ queryKey: storageKeys.all })
			setIsConfirming(false)
		} catch {
			setError(t("rebuild.failed", { ns: "errors" }))
		} finally {
			setIsRebuilding(false)
		}
	}

	return (
		<div
			aria-describedby="rebuild-index-description"
			aria-labelledby="rebuild-index-title"
			className="rebuild-confirmation"
			role="alertdialog"
		>
			<strong id="rebuild-index-title">{t("rebuild.title", { ns: "errors" })}</strong>
			<p id="rebuild-index-description">{t("rebuild.description", { ns: "errors" })}</p>
			{error ? <p role="alert">{error}</p> : null}
			<div className="rebuild-confirmation__actions">
				<button
					className="secondary-button"
					disabled={isRebuilding}
					onClick={() => setIsConfirming(false)}
					type="button"
				>
					{t("actions.cancel")}
				</button>
				<button className="primary-button" disabled={isRebuilding} onClick={() => void rebuild()} type="button">
					{isRebuilding ? t("actions.rebuilding") : t("actions.confirmRebuild")}
				</button>
			</div>
		</div>
	)
}

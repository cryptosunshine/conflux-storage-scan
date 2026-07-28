import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useStorageDataSource } from "../../app/providers"
import { storageKeys } from "../../data/queries"

export function RebuildIndexButton() {
	const dataSource = useStorageDataSource()
	const queryClient = useQueryClient()
	const [isConfirming, setIsConfirming] = useState(false)
	const [isRebuilding, setIsRebuilding] = useState(false)
	const [error, setError] = useState<string>()

	if (!isConfirming) {
		return (
			<button className="secondary-button" onClick={() => setIsConfirming(true)} type="button">
				Rebuild local index
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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The local index could not be rebuilt.")
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
			<strong id="rebuild-index-title">Rebuild local index?</strong>
			<p id="rebuild-index-description">
				This deletes the Conflux Storage Scan local index in this browser. It does not delete or change chain data.
			</p>
			{error ? <p role="alert">{error}</p> : null}
			<div className="rebuild-confirmation__actions">
				<button
					className="secondary-button"
					disabled={isRebuilding}
					onClick={() => setIsConfirming(false)}
					type="button"
				>
					Cancel
				</button>
				<button className="primary-button" disabled={isRebuilding} onClick={() => void rebuild()} type="button">
					{isRebuilding ? "Rebuilding…" : "Confirm rebuild"}
				</button>
			</div>
		</div>
	)
}

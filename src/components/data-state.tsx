import type { ReactNode } from "react"
import type { SyncState } from "../chain/sync/sync-submissions"

export interface DataStateProps {
	readonly state: SyncState
	readonly onRetry?: () => void
	readonly recoveryAction?: ReactNode
}

function LastSynced({ value }: { readonly value: number }) {
	const date = new Date(value)
	return (
		<span>
			Last synced <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>
		</span>
	)
}

function incompatibleTitle(state: Extract<SyncState, { status: "incompatible-contract" }>): string {
	return state.error.code === "CHAIN_ID_MISMATCH" ? "Wrong network" : "Contract update detected"
}

function partialTitle(state: Extract<SyncState, { status: "partial" }>): string {
	return state.error.code === "CACHE_CORRUPT" ? "Local index needs rebuilding" : "Data may be incomplete"
}

export function DataState({ state, onRetry, recoveryAction }: DataStateProps) {
	if (state.status === "idle" || state.status === "fresh") {
		return null
	}

	if (state.status === "syncing") {
		return (
			<div aria-live="polite" className="data-notice data-notice--info">
				<div>
					<strong>Indexing submissions</strong>
					<p>
						Reading blocks {state.fromBlock.toString()}–{state.toBlock.toString()}.
					</p>
				</div>
			</div>
		)
	}

	if (state.status === "incompatible-contract") {
		return (
			<div className="data-notice data-notice--blocking" role="alert">
				<div>
					<strong>{incompatibleTitle(state)}</strong>
					<p>{state.error.message}</p>
					{state.error.code === "CHAIN_ID_MISMATCH" ? null : (
						<p>New logs are paused until the deployed implementation and ABI are verified.</p>
					)}
				</div>
			</div>
		)
	}

	if (state.status === "partial") {
		return (
			<div className="data-notice data-notice--warning" role="status">
				<div>
					<strong>{partialTitle(state)}</strong>
					<p>{state.error.message}</p>
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
						Retry
					</button>
				) : null}
			</div>
		)
	}

	return (
		<div className="data-notice data-notice--warning" role="status">
			<div>
				<strong>Showing cached data</strong>
				<p>{state.error.message}</p>
				<small>
					<LastSynced value={state.lastSuccessAt} />
				</small>
			</div>
			{onRetry ? (
				<button className="secondary-button" onClick={onRetry} type="button">
					Retry
				</button>
			) : null}
		</div>
	)
}

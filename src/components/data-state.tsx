import type { SyncState } from "../chain/sync/sync-submissions"

export interface DataStateProps {
	readonly state: SyncState
	readonly onRetry?: () => void
}

function LastSynced({ value }: { readonly value: number }) {
	const date = new Date(value)
	return (
		<span>
			Last synced <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>
		</span>
	)
}

export function DataState({ state, onRetry }: DataStateProps) {
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
					<strong>Contract update detected</strong>
					<p>
						New logs are paused until the deployed implementation and ABI are verified. Cached records remain available.
					</p>
				</div>
			</div>
		)
	}

	if (state.status === "partial") {
		return (
			<div className="data-notice data-notice--warning" role="status">
				<div>
					<strong>Data may be incomplete</strong>
					<p>{state.error.message}</p>
					{state.lastSuccessAt === undefined ? null : (
						<small>
							<LastSynced value={state.lastSuccessAt} />
						</small>
					)}
				</div>
				{onRetry ? (
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

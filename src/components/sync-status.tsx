import type { SyncState } from "../chain/sync/sync-submissions"

const labels: Readonly<Record<SyncState["status"], string>> = {
	idle: "Not synced",
	syncing: "Syncing",
	fresh: "Up to date",
	stale: "Cached",
	partial: "Partial",
	"incompatible-contract": "Verification required",
}

export function SyncStatus({ state }: { readonly state: SyncState }) {
	return (
		<span className={`sync-status sync-status--${state.status}`}>
			<span aria-hidden="true" className="sync-status__dot" />
			{labels[state.status]}
		</span>
	)
}

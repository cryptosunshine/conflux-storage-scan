import { useTranslation } from "react-i18next"
import type { SyncState } from "../chain/sync/sync-submissions"

export function SyncStatus({ state }: { readonly state: SyncState }) {
	const { t } = useTranslation("common")
	const labels: Readonly<Record<SyncState["status"], string>> = {
		fresh: t("sync.status.fresh"),
		idle: t("sync.status.idle"),
		"incompatible-contract": t("sync.status.incompatible"),
		partial: t("sync.status.partial"),
		stale: t("sync.status.cached"),
		syncing: t("sync.status.syncing"),
	}
	return (
		<span className={`sync-status sync-status--${state.status}`}>
			<span aria-hidden="true" className="sync-status__dot" />
			{labels[state.status]}
		</span>
	)
}

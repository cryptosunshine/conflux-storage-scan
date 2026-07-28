import type { ComponentProps } from "react"
import { DataState } from "../../components/data-state"
import { RebuildIndexButton } from "./rebuild-index-button"

export function RecoveryDataState(props: ComponentProps<typeof DataState>) {
	const isCacheCorrupt =
		(props.state.status === "partial" || props.state.status === "stale") && props.state.error.code === "CACHE_CORRUPT"

	return <DataState {...props} recoveryAction={isCacheCorrupt ? <RebuildIndexButton /> : props.recoveryAction} />
}

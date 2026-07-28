import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useStorageDataSource } from "../../app/providers"
import { invalidateStorageAfterSync, storageKeys } from "../../data/queries"

export function useStorageSync() {
	const dataSource = useStorageDataSource()
	const queryClient = useQueryClient()

	return useQuery({
		queryFn: async ({ signal }) => {
			const state = await dataSource.sync(signal)
			await invalidateStorageAfterSync(queryClient)
			return state
		},
		queryKey: storageKeys.sync(),
		refetchOnWindowFocus: false,
		staleTime: 30_000,
	})
}

import { QueryClient } from "@tanstack/react-query"

export function createAppQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				refetchOnWindowFocus: false,
				retry: 2,
				staleTime: 30_000,
			},
		},
	})
}

export const queryClient = createAppQueryClient()

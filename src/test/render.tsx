import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type RenderOptions, render } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

export function renderWithQuery(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	})

	function Wrapper({ children }: { readonly children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	}

	return {
		queryClient,
		...render(ui, { ...options, wrapper: Wrapper }),
	}
}

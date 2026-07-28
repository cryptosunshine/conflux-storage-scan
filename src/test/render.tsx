import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router"
import { type RenderOptions, render } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { AppProviders } from "../app/providers"
import type { StorageDataSource } from "../data/storage-data-source"

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

export async function renderWithDataSource(
	ui: ReactElement,
	dataSource: StorageDataSource,
	options?: Omit<RenderOptions, "wrapper">,
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	})
	const rootRoute = createRootRoute({ component: Outlet })
	const indexRoute = createRoute({
		component: () => ui,
		getParentRoute: () => rootRoute,
		path: "/",
	})
	const submissionRoute = createRoute({
		component: () => <p>Submission route</p>,
		getParentRoute: () => rootRoute,
		path: "/submission/$sequence",
	})
	const addressRoute = createRoute({
		component: () => <p>Address route</p>,
		getParentRoute: () => rootRoute,
		path: "/address/$address",
	})
	const submissionsRoute = createRoute({
		component: () => <p>Submissions route</p>,
		getParentRoute: () => rootRoute,
		path: "/submissions",
	})
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree: rootRoute.addChildren([indexRoute, submissionRoute, addressRoute, submissionsRoute]),
	})
	await router.load()

	return {
		queryClient,
		router,
		...render(
			<AppProviders dataSource={dataSource} queryClient={queryClient}>
				<RouterProvider router={router} />
			</AppProviders>,
			options,
		),
	}
}

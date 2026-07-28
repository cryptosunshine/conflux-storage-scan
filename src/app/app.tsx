import { createRouter, RouterProvider } from "@tanstack/react-router"
import { routeTree } from "../routeTree.gen"

export const router = createRouter({
	defaultPreload: "intent",
	routeTree,
	scrollRestoration: true,
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

export function App() {
	return <RouterProvider router={router} />
}

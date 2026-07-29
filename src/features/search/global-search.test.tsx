import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { testI18n } from "../../test/i18n"
import { GlobalSearch } from "./global-search"

function createSearchRouter() {
	let navigateFromSearch: (path: string) => void = () => undefined
	const rootRoute = createRootRoute({
		component: () => <GlobalSearch onNavigate={navigateFromSearch} />,
		notFoundComponent: () => <p>Not found</p>,
	})
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <p>Home</p>,
	})
	const submissionRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/submission/$sequence",
		component: () => <p>Submission</p>,
	})
	const addressRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/address/$address",
		component: () => <p>Address</p>,
	})
	const routeTree = rootRoute.addChildren([indexRoute, submissionRoute, addressRoute])
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree,
	})
	navigateFromSearch = (path) => {
		void router.navigate({ to: path })
	}
	return router
}

async function renderSearch(): Promise<ReturnType<typeof createSearchRouter>> {
	const router = createSearchRouter()
	await router.load()
	render(<RouterProvider router={router} />)
	return router
}

describe("GlobalSearch", () => {
	it("marks explorer input as a non-auth search field", async () => {
		await renderSearch()

		expect(screen.getByRole("searchbox")).toHaveAttribute("autocomplete", "off")
		expect(screen.getByRole("searchbox")).toHaveAttribute("inputmode", "search")
		expect(screen.getByRole("searchbox")).toHaveAttribute("name", "explorer-search")
		expect(screen.getByRole("searchbox")).toHaveAttribute("spellcheck", "false")
	})

	it.each([
		["484", "/submission/484"],
		["0xe9B0afd0DccB44Bc6e0a49f8032Cc7815A221ebE", "/address/0xe9B0afd0DccB44Bc6e0a49f8032Cc7815A221ebE"],
	])("routes %s to %s", async (value, expected) => {
		const user = userEvent.setup()
		const router = await renderSearch()

		await user.type(screen.getByRole("searchbox"), value)
		await user.keyboard("{Enter}")

		expect(router.state.location.pathname).toBe(expected)
	})

	it.each(["-1", "1.5", "0x113268b1ac95b5665f0fa6036445333619711c2dcae2ca78e2edc0843c089512", "0x1234"])(
		"rejects %s locally",
		async (value) => {
			const user = userEvent.setup()
			const router = await renderSearch()

			await user.type(screen.getByRole("searchbox"), value)
			await user.keyboard("{Enter}")

			expect(screen.getByRole("alert")).toHaveTextContent(/sequence or a 42-character EVM address/i)
			expect(router.state.location.pathname).toBe("/")
		},
	)

	it("localizes validation without changing search routing", async () => {
		await testI18n.changeLanguage("zh-CN")
		const user = userEvent.setup()
		const router = await renderSearch()

		await user.type(screen.getByRole("searchbox", { name: "按提交序号或地址搜索" }), "-1")
		await user.keyboard("{Enter}")

		expect(screen.getByRole("alert")).toHaveTextContent("请输入非负提交序号")
		expect(router.state.location.pathname).toBe("/")
	})
})

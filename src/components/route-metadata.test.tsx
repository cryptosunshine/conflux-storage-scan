import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router"
import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { testI18n } from "../test/i18n"
import { RouteMetadata, shortenMetadataAddress } from "./route-metadata"

function createMetadataRouter(initialEntry: string) {
	const rootRoute = createRootRoute({
		component: () => (
			<>
				<RouteMetadata />
				<Outlet />
			</>
		),
	})
	const routes = [
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/",
		}),
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/submissions",
		}),
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/submission/$sequence",
		}),
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/address/$address",
		}),
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/history",
		}),
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/analytics",
		}),
		createRoute({
			component: () => null,
			getParentRoute: () => rootRoute,
			path: "/storage",
		}),
	]

	return createRouter({
		history: createMemoryHistory({ initialEntries: [initialEntry] }),
		routeTree: rootRoute.addChildren(routes),
	})
}

async function expectMetadata(path: string, expectedTitle: string, expectedDescription: string) {
	const router = createMetadataRouter(path)
	await router.load()
	const view = render(<RouterProvider router={router} />)

	await waitFor(() => {
		expect(document.title).toBe(expectedTitle)
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", expectedDescription)
	})
	view.unmount()
}

describe("RouteMetadata", () => {
	beforeEach(() => {
		document.title = ""
		for (const metadata of document.querySelectorAll('meta[name="description"]')) {
			metadata.remove()
		}
		const description = document.createElement("meta")
		description.name = "description"
		document.head.append(description)
	})

	it("derives English metadata from local route state", async () => {
		const description = "Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet."
		await expectMetadata("/", "Conflux Storage Explorer — Conflux Storage Scan", description)
		await expectMetadata("/submissions", "Storage Submissions — Conflux Storage Scan", description)
		await expectMetadata("/submission/484", "Submission #484 — Conflux Storage Scan", description)
		await expectMetadata(
			"/address/0x6493fe3530Ad2D3C564e11222d7f029114B8AB8d",
			"Address 0x6493…AB8d — Conflux Storage Scan",
			description,
		)
		await expectMetadata("/history", "My Submissions — Conflux Storage Scan", description)
		await expectMetadata("/analytics", "Storage Analytics — Conflux Storage Scan", description)
		await expectMetadata("/storage", "Direct Storage — Conflux Storage Scan", description)
	})

	it("updates route metadata when the language changes", async () => {
		await testI18n.changeLanguage("zh-CN")
		await expectMetadata(
			"/submission/484",
			"提交 #484 — Conflux Storage Scan",
			"浏览从 Conflux eSpace 测试网索引的 FixedPriceFlow 存储提交。",
		)
		await expectMetadata(
			"/storage",
			"存储直连 POC — Conflux Storage Scan",
			"浏览从 Conflux eSpace 测试网索引的 FixedPriceFlow 存储提交。",
		)
	})

	it("shortens long addresses without changing short route values", () => {
		expect(shortenMetadataAddress("0x6493fe3530Ad2D3C564e11222d7f029114B8AB8d")).toBe("0x6493…AB8d")
		expect(shortenMetadataAddress("0x1234")).toBe("0x1234")
	})
})

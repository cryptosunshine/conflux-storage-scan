import { QueryClient } from "@tanstack/react-query"
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AppProviders } from "../../app/providers"
import { createFixtureDataSource } from "../../data/fixture-data-source"
import { createSubmissionFixture } from "../../test/fixtures"
import { testI18n } from "../../test/i18n"
import { AnalyticsPage } from "./analytics-page"

async function renderAnalyticsPage() {
	const rootRoute = createRootRoute({ component: Outlet })
	const analyticsRoute = createRoute({
		component: () => <AnalyticsPage metric="submissions" range="7d" />,
		getParentRoute: () => rootRoute,
		path: "/analytics",
	})
	const router = createRouter({
		history: createMemoryHistory({
			initialEntries: ["/analytics?metric=submissions&range=7d"],
		}),
		routeTree: rootRoute.addChildren([analyticsRoute]),
	})
	const dataSource = createFixtureDataSource({
		allocatedSectorCount: 64n,
		contractSubmissionCount: 2n,
		headBlock: 258_293_674n,
		submissions: [
			createSubmissionFixture(0n, {
				timestamp: Math.floor(Date.UTC(2026, 6, 1) / 1_000),
			}),
			createSubmissionFixture(1n, {
				timestamp: Math.floor(Date.UTC(2026, 6, 2) / 1_000),
			}),
		],
	})
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	})
	await router.load()
	render(
		<AppProviders dataSource={dataSource} queryClient={queryClient}>
			<RouterProvider router={router} />
		</AppProviders>,
	)
	return router
}

describe("AnalyticsPage", () => {
	it("renders the analytics route in Simplified Chinese", async () => {
		await testI18n.changeLanguage("zh-CN")
		await renderAnalyticsPage()

		expect(await screen.findByRole("heading", { name: "存储分析" })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "已索引存储增长" })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "每日提交活动" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "7 天" })).toHaveAttribute("aria-current", "page")
		expect(screen.getByRole("navigation", { name: "分析时间范围" })).toBeInTheDocument()
	})

	it("shows both charts, preserves the selected range in the URL, and focuses the requested metric", async () => {
		const router = await renderAnalyticsPage()
		const user = userEvent.setup()

		expect(await screen.findByRole("heading", { name: "Storage analytics" })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "Indexed storage growth" })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "Daily submission activity" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "7D" })).toHaveAttribute("aria-current", "page")

		const submissionsSection = screen.getByRole("region", {
			name: "Daily submission activity",
		})
		await waitFor(() => expect(submissionsSection).toHaveFocus())

		await user.click(screen.getByRole("link", { name: "30D" }))
		await waitFor(() => expect(router.state.location.href).toContain("metric=submissions&range=30d"))
	})
})

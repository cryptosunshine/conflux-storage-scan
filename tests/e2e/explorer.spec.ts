import { expect, test } from "@playwright/test"

const firstSubmitter = "0x6493fe3530Ad2D3C564e11222d7f029114B8AB8d"
const latestTransaction = "0x2b863eee7ba6010629b4f1781e3725be4264973ace02ce10193aeaf9df664479"

test("dashboard navigates to the canonical submissions index", async ({ page }) => {
	const liveRpcRequests: string[] = []
	page.on("request", (request) => {
		if (/confluxrpc|confura/i.test(request.url())) {
			liveRpcRequests.push(request.url())
		}
	})
	await page.goto("/")

	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	await expect(page.getByText("Contract submissions").locator("..").getByText("485", { exact: true })).toBeVisible()
	await expect(page.getByText("Storage fee").locator("..").getByText("0 CFX", { exact: true })).toBeVisible()

	await page.getByRole("link", { name: "Submissions", exact: true }).click()
	await expect(page).toHaveURL(/\/submissions\?page=1$/)
	await expect(page.getByRole("heading", { name: "Storage submissions" })).toBeVisible()
	await expect(page.getByRole("link", { name: "#484" })).toBeVisible()
	expect(liveRpcRequests).toEqual([])
})

test("dashboard analytics open the all-history detail view and preserve URL range state", async ({ page }) => {
	await page.goto("/")

	const storageAnalytics = page.getByRole("link", { name: "View storage growth analytics" })
	await expect(storageAnalytics).toBeVisible()
	const previewChart = storageAnalytics.getByLabel("Storage growth chart in MiB")
	await expect(previewChart).toBeVisible()
	expect((await previewChart.boundingBox())?.height).toBeGreaterThan(140)

	await storageAnalytics.click()
	await expect(page).toHaveURL(/\/analytics\?metric=storage&range=all$/)
	await expect(page.getByRole("heading", { name: "Storage analytics" })).toBeVisible()
	await expect(page.getByRole("region", { name: "Indexed storage growth" })).toBeFocused()

	const detailChart = page.getByLabel("Storage growth chart in MiB")
	expect((await detailChart.boundingBox())?.height).toBeGreaterThan(250)

	await page.getByRole("link", { name: "30D", exact: true }).click()
	await expect(page).toHaveURL(/\/analytics\?metric=storage&range=30d$/)
	await expect(page.getByRole("link", { name: "30D", exact: true })).toHaveAttribute("aria-current", "page")

	await page.reload()
	await expect(page.getByRole("link", { name: "30D", exact: true })).toHaveAttribute("aria-current", "page")
	await page.goBack()
	await expect(page).toHaveURL(/\/analytics\?metric=storage&range=all$/)
	await expect(page.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "page")
	await page.goForward()
	await expect(page).toHaveURL(/\/analytics\?metric=storage&range=30d$/)
})

test("dashboard analytics preview cards align their plots and actions", async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1440 })
	await page.goto("/")

	const storageCard = page.getByRole("link", { name: "View storage growth analytics" })
	const activityCard = page.getByRole("link", { name: "View submission activity analytics" })
	await expect(storageCard).toBeVisible()
	await expect(activityCard).toBeVisible()

	const storageSummary = storageCard.getByText(/^Logical data reached/)
	const storageSummaryLineCount = await storageSummary.evaluate((element) => {
		const range = document.createRange()
		range.selectNodeContents(element)
		return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size
	})
	const storageChartBox = await storageCard.getByLabel("Storage growth chart in MiB").boundingBox()
	const activityChartBox = await activityCard.getByLabel("Daily submission activity chart").boundingBox()
	const storageActionBox = await storageCard.locator(".analytics-preview-card__action").boundingBox()
	const activityActionBox = await activityCard.locator(".analytics-preview-card__action").boundingBox()

	expect(storageSummaryLineCount).toBe(1)
	expect(storageChartBox).not.toBeNull()
	expect(activityChartBox).not.toBeNull()
	expect(Math.abs((storageChartBox?.y ?? 0) - (activityChartBox?.y ?? 0))).toBeLessThanOrEqual(1)
	expect(Math.abs((storageChartBox?.height ?? 0) - (activityChartBox?.height ?? 0))).toBeLessThanOrEqual(1)
	expect(storageActionBox).not.toBeNull()
	expect(activityActionBox).not.toBeNull()
	expect(Math.abs((storageActionBox?.y ?? 0) - (activityActionBox?.y ?? 0))).toBeLessThanOrEqual(1)

	await page.setViewportSize({ height: 900, width: 1024 })
	const tabletStorageChartBox = await storageCard.getByLabel("Storage growth chart in MiB").boundingBox()
	const tabletActivityChartBox = await activityCard.getByLabel("Daily submission activity chart").boundingBox()
	expect(tabletStorageChartBox).not.toBeNull()
	expect(tabletActivityChartBox).not.toBeNull()
	expect(Math.abs((tabletStorageChartBox?.y ?? 0) - (tabletActivityChartBox?.y ?? 0))).toBeLessThanOrEqual(1)
})

test("keyboard users can skip the repeated header", async ({ page }) => {
	await page.goto("/")
	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	await page.keyboard.press("Tab")

	const skipLink = page.getByRole("link", { name: "Skip to main content" })
	await expect(skipLink).toBeFocused()
	await expect(skipLink).toHaveCSS("outline-width", "2px")
	await page.keyboard.press("Enter")
	await expect(page).toHaveURL(/#main-content$/)
})

test("global search resolves a sequence and an address", async ({ page }) => {
	await page.goto("/")

	const search = page.getByRole("searchbox", {
		name: "Search by submission sequence or submitter address",
	})
	await search.fill("0")
	await page.getByRole("button", { name: "Search" }).click()
	await expect(page).toHaveURL(/\/submission\/0$/)
	await expect(page.getByRole("heading", { name: "Submission #0" })).toBeVisible()

	await search.fill(firstSubmitter)
	await page.getByRole("button", { name: "Search" }).click()
	await expect(page).toHaveURL(new RegExp(`/address/${firstSubmitter}`, "i"))
	await expect(page.getByRole("heading", { name: "Address activity" })).toBeVisible()
	await expect(page.getByText(firstSubmitter, { exact: true })).toBeVisible()
})

test("submission detail wide fields fill the details grid", async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1440 })
	await page.goto("/submission/484")

	const details = page.getByRole("region", { name: "Submission details" })
	await expect(details).toBeVisible()
	const gridBox = await details.locator(".detail-grid").boundingBox()
	const submitterBox = await details.getByText("Submitter", { exact: true }).locator("..").boundingBox()
	const identityBox = await details.getByText("Submission identity", { exact: true }).locator("..").boundingBox()

	expect(gridBox).not.toBeNull()
	expect(submitterBox).not.toBeNull()
	expect(identityBox).not.toBeNull()
	expect(Math.abs((submitterBox?.x ?? 0) - (gridBox?.x ?? 0))).toBeLessThanOrEqual(1)
	expect(Math.abs((submitterBox?.width ?? 0) - (gridBox?.width ?? 0))).toBeLessThanOrEqual(1)
	expect(Math.abs((submitterBox?.width ?? 0) - (identityBox?.width ?? 0))).toBeLessThanOrEqual(1)
})

test("an unknown sequence renders a clean empty state without query errors", async ({ page }) => {
	const queryErrors: string[] = []
	page.on("console", (message) => {
		if (message.type() === "error" && message.text().includes("Query data cannot be undefined")) {
			queryErrors.push(message.text())
		}
	})

	await page.goto("/submission/999999")
	await expect(page.getByRole("heading", { name: "Submission not found" })).toBeVisible()
	expect(queryErrors).toEqual([])
})

test("invalid direct route parameters render actionable explorer errors", async ({ page }) => {
	await page.goto("/submission/-1")
	await expect(page.getByRole("heading", { name: "Invalid Explorer Link" })).toBeVisible()
	await expect(page.getByText(/sequence must be a non-negative integer/i)).toBeVisible()

	await page.goto("/address/0x123")
	await expect(page.getByRole("heading", { name: "Invalid Explorer Link" })).toBeVisible()
	await expect(page.getByText(/42-character EVM address/i)).toBeVisible()
})

test("pagination survives reload and external transaction links target ConfluxScan", async ({ page }) => {
	await page.goto("/submissions?page=2")
	await expect(page.getByRole("link", { name: "#464" })).toBeVisible()

	await page.reload()
	await expect(page).toHaveURL(/\/submissions\?page=2$/)
	await expect(page.getByRole("link", { name: "#464" })).toBeVisible()

	await page.goto("/submissions?page=1")
	const transactionLink = page.getByRole("link", {
		name: `View transaction ${latestTransaction} on ConfluxScan`,
	})
	await expect(transactionLink).toHaveAttribute("href", `https://evmtestnet.confluxscan.org/tx/${latestTransaction}`)
	await expect(transactionLink).toHaveAttribute("target", "_blank")
})

test("a stale fixture preserves cached content and succeeds on retry", async ({ page }) => {
	await page.goto("/?fixtureState=stale-once")

	await expect(page.getByText("Showing cached data")).toBeVisible()
	await expect(page.getByRole("link", { name: "#484" })).toBeVisible()
	await expect(page.getByRole("link", { name: "View storage growth analytics" })).toBeVisible()
	await page.getByRole("button", { name: "Retry" }).click()

	await expect(page.getByText("Showing cached data")).toBeHidden()
	await expect(page.getByText("Up to date")).toBeVisible()
})

test("a persistent RPC failure retains the cached fixture", async ({ page }) => {
	await page.goto("/?fixtureState=rpc-error")

	await expect(page.getByText("Showing cached data")).toBeVisible()
	await expect(page.getByText("The RPC request timed out (RPC_TIMEOUT)")).toBeVisible()
	await expect(page.getByRole("link", { name: "#484" })).toBeVisible()
	await expect(page.getByRole("link", { name: "View submission activity analytics" })).toBeVisible()
})

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

test("global search resolves a sequence and an address", async ({ page }) => {
	await page.goto("/")

	const search = page.getByRole("searchbox", { name: "Search by submission sequence or address" })
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
	await page.getByRole("button", { name: "Retry" }).click()

	await expect(page.getByText("Showing cached data")).toBeHidden()
	await expect(page.getByText("Up to date")).toBeVisible()
})

test("a persistent RPC failure retains the cached fixture", async ({ page }) => {
	await page.goto("/?fixtureState=rpc-error")

	await expect(page.getByText("Showing cached data")).toBeVisible()
	await expect(page.getByText(/fixture rpc timed out/i)).toBeVisible()
	await expect(page.getByRole("link", { name: "#484" })).toBeVisible()
})

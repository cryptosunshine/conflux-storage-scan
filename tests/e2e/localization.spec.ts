import { expect, test } from "@playwright/test"

const languageStorageKey = "conflux-storage-scan-language"

test.use({ locale: "zh-CN" })

test("follows the browser language and persists an explicit footer selection", async ({ page }) => {
	const liveRpcRequests: string[] = []
	page.on("request", (request) => {
		if (/confluxrpc|confura/i.test(request.url())) {
			liveRpcRequests.push(request.url())
		}
	})

	await page.goto("/")
	await expect(page.getByRole("heading", { name: "存储概览" })).toBeVisible()
	await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")
	await expect(page.getByLabel("语言")).toHaveValue("zh-CN")

	const currentUrl = page.url()
	await page.getByLabel("语言").selectOption("en-US")

	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	await expect(page.locator("html")).toHaveAttribute("lang", "en-US")
	expect(page.url()).toBe(currentUrl)
	expect(await page.evaluate((key) => localStorage.getItem(key), languageStorageKey)).toBe("en-US")

	await page.reload()
	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	await expect(page.getByLabel("Language")).toHaveValue("en-US")
	expect(liveRpcRequests).toEqual([])
})

test("keeps public explorer routes usable in Simplified Chinese", async ({ page }) => {
	await page.goto("/")
	await page.getByRole("link", { name: "提交记录", exact: true }).click()

	await expect(page.getByRole("heading", { name: "存储提交记录" })).toBeVisible()
	await page.getByRole("link", { name: "#484" }).click()
	await expect(page.getByRole("heading", { name: "提交 #484" })).toBeVisible()
	await expect(page.getByRole("region", { name: "提交详情" })).toBeVisible()

	await page.goto("/analytics?metric=storage&range=all")
	await expect(page.getByRole("heading", { name: "存储分析" })).toBeVisible()
	await expect(page.getByRole("heading", { name: "已索引存储增长" })).toBeVisible()

	await page.goto("/history?page=1")
	await expect(page.getByRole("heading", { name: "我的提交" })).toBeVisible()
	await expect(page.getByText("连接钱包后可按当前账户筛选公开 FixedPriceFlow 索引。")).toBeVisible()
})

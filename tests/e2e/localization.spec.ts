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
	const language = page.getByRole("combobox", { name: "语言" })
	await expect(language).toContainText("中文（简体）")

	const currentUrl = page.url()
	await language.click()
	await page.getByRole("option", { name: "English" }).click()

	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	await expect(page.locator("html")).toHaveAttribute("lang", "en-US")
	await expect(page.getByRole("combobox", { name: "Language" })).toContainText("English")
	expect(page.url()).toBe(currentUrl)
	expect(await page.evaluate((key) => localStorage.getItem(key), languageStorageKey)).toBe("en-US")

	await page.reload()
	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	await expect(page.getByRole("combobox", { name: "Language" })).toContainText("English")
	expect(liveRpcRequests).toEqual([])
})

test("localizes document metadata for explorer routes without live RPC", async ({ page }) => {
	const liveRpcRequests: string[] = []
	page.on("request", (request) => {
		if (/confluxrpc|confura/i.test(request.url())) {
			liveRpcRequests.push(request.url())
		}
	})

	await page.goto("/")
	await expect(page).toHaveTitle("Conflux 存储浏览器 — Conflux Storage Scan")
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		"content",
		"浏览从 Conflux eSpace 测试网索引的 FixedPriceFlow 存储提交。",
	)

	await page.goto("/submissions?page=1")
	await expect(page).toHaveTitle("存储提交记录 — Conflux Storage Scan")

	await page.goto("/submission/484")
	await expect(page).toHaveTitle("提交 #484 — Conflux Storage Scan")

	await page.goto("/address/0x6493fe3530Ad2D3C564e11222d7f029114B8AB8d?page=1")
	await expect(page).toHaveTitle("地址 0x6493…AB8d — Conflux Storage Scan")

	await page.goto("/history?page=1")
	await expect(page).toHaveTitle("我的提交 — Conflux Storage Scan")

	await page.goto("/analytics?metric=storage&range=all")
	await expect(page).toHaveTitle("存储分析 — Conflux Storage Scan")

	await page.goto("/unsupported")
	await expect(page).toHaveTitle("浏览器页面 — Conflux Storage Scan")

	const language = page.getByRole("combobox", { name: "语言" })
	await language.click()
	await page.getByRole("option", { name: "English" }).click()
	await expect(page).toHaveTitle("Explorer Page — Conflux Storage Scan")
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		"content",
		"Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet.",
	)

	await page.goto("/analytics?metric=storage&range=all")
	await expect(page).toHaveTitle("Storage Analytics — Conflux Storage Scan")

	expect(liveRpcRequests).toEqual([])
})

test("keeps the language menu inside desktop, tablet, and mobile viewports", async ({ page }) => {
	for (const width of [1440, 1024, 390]) {
		await page.setViewportSize({ height: 900, width })
		await page.goto("/")

		const language = page.getByRole("combobox", { name: "语言" })
		const trigger = page.locator(".language-select__trigger")
		await language.scrollIntoViewIfNeeded()
		await language.click()
		await expect(trigger).toHaveAttribute("aria-expanded", "true")

		const chineseOption = page.getByRole("option", { name: "中文（简体）" })
		await expect(chineseOption).toBeVisible()

		const menuMetrics = await chineseOption.evaluate((option) => {
			const text = option.querySelector("span")
			if (!(text instanceof HTMLElement) || text.textContent !== "中文（简体）") {
				throw new Error("Language option text is missing")
			}

			const style = getComputedStyle(option)
			const range = document.createRange()
			range.selectNodeContents(text)
			const lineTops = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)))

			return {
				fontSize: style.fontSize,
				height: option.getBoundingClientRect().height,
				lineCount: lineTops.size,
				whiteSpace: style.whiteSpace,
			}
		})

		expect(menuMetrics.fontSize).toBe("13px")
		expect(menuMetrics.whiteSpace).toBe("nowrap")
		expect(menuMetrics.lineCount).toBe(1)
		expect(menuMetrics.height).toBeLessThanOrEqual(36)

		const triggerBox = await trigger.boundingBox()
		const englishOptionBox = await page.getByRole("option", { name: "English" }).boundingBox()
		expect(triggerBox).not.toBeNull()
		expect(englishOptionBox).not.toBeNull()
		expect(englishOptionBox?.y).toBeLessThan(triggerBox?.y ?? 0)
		expect((englishOptionBox?.x ?? 0) + (englishOptionBox?.width ?? 0)).toBeLessThanOrEqual(width)
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
		).toBe(true)

		await page.keyboard.press("Escape")
		await expect(language).toBeFocused()
	}
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

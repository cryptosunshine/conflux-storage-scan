import { expect, test } from "@playwright/test"

test("mobile keeps navigation, search, and submission details accessible without page overflow", async ({ page }) => {
	await page.goto("/")

	await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible()
	await expect(
		page.getByRole("searchbox", { name: "Search by submission sequence or submitter address" }),
	).toBeVisible()
	await expect(page.getByRole("heading", { name: "Storage overview" })).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
		true,
	)

	await page.getByRole("link", { name: "Submissions", exact: true }).click()
	await page.getByRole("link", { name: "#484" }).click()
	await expect(page.getByRole("heading", { name: "Submission #484" })).toBeVisible()
	await expect(page.getByText("Submission details")).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
		true,
	)
})

test("mobile stacks analytics cards and keeps the detail charts inside the viewport", async ({ page }) => {
	await page.goto("/")

	const storageAnalytics = page.getByRole("link", { name: "View storage growth analytics" })
	const submissionAnalytics = page.getByRole("link", { name: "View submission activity analytics" })
	await expect(storageAnalytics).toBeVisible()
	await expect(submissionAnalytics).toBeVisible()

	const storageBox = await storageAnalytics.boundingBox()
	const submissionBox = await submissionAnalytics.boundingBox()
	expect(storageBox).not.toBeNull()
	expect(submissionBox).not.toBeNull()
	expect(submissionBox?.y).toBeGreaterThan((storageBox?.y ?? 0) + (storageBox?.height ?? 0) - 1)
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
		true,
	)

	await submissionAnalytics.click()
	await expect(page).toHaveURL(/\/analytics\?metric=submissions&range=all$/)
	await expect(page.getByRole("region", { exact: true, name: "Daily submission activity" })).toBeFocused()
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
		true,
	)
})

test("tablet width preserves primary route navigation", async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1024 })
	await page.goto("/")

	await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible()
	await expect(page.getByRole("link", { name: "Submissions", exact: true })).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024)
})

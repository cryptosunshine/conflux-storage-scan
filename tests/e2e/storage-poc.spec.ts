import { expect, test } from "@playwright/test"

test("prepares and verifies files without contacting live Storage Nodes", async ({ page }) => {
	const directNodeRequests: string[] = []
	page.on("request", (request) => {
		if (/0gdevnet\.confluxrpc\.org|47\.84\.(?:225\.228|224\.253):5678/.test(request.url())) {
			directNodeRequests.push(request.url())
		}
	})

	await page.goto("/storage")
	await expect(page.getByRole("heading", { name: "Upload resources" })).toBeVisible()
	await expect(page.getByText("0gdevnet.confluxrpc.org")).toBeVisible()
	await expect(page.getByText("Available")).toBeVisible()
	await expect(page.getByText("0 CFX", { exact: true })).toBeVisible()
	await expect(page.getByText(/network gas is shown separately/i)).toBeVisible()

	await page.getByLabel("Choose file").setInputFiles({
		buffer: Buffer.from([0]),
		mimeType: "application/octet-stream",
		name: "fixture.bin",
	})
	await expect(page.getByText("Merkle Root ready")).toBeVisible()
	await expect(page.getByRole("button", { name: "Connect wallet to continue" })).toBeVisible()

	await page.getByLabel("TxSeq or Merkle Root").fill("485")
	await page.getByRole("button", { name: "Download resource" }).click()
	await expect(page.getByText("Merkle Root verified")).toBeVisible()
	await expect(page.getByRole("link", { name: "Save file" })).toHaveAttribute("download", "storage-485.bin")
	expect(directNodeRequests).toEqual([])
})

test("invalid download input is announced without a wallet", async ({ page }) => {
	await page.goto("/storage")
	await page.getByLabel("TxSeq or Merkle Root").fill("not-a-sequence")
	await page.getByRole("button", { name: "Download resource" }).click()

	await expect(page.getByRole("alert")).toContainText("Enter a valid TxSeq or 32-byte Merkle Root")
})

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const PUBLIC_ASSET_HASHES = {
	"espace-icon.svg": "5f577db55f89a8ddb06518a93af1134d95fa926d8464c4df970c65b3da7dedf4",
	"favicon.ico": "2e72e4569660e6b134e1c43559b9baa4ee762df2f37146fd55671c8eb0e752b7",
	"logo192.png": "0b70f4ed4050da15245521a10e20ef959d4895027d04c824aa10d898d0db2a1b",
	"logo512.png": "074902f14de0102a5f57d932956535818ae0ed1a037c1fecb5adcd0e446bde80",
} as const

const DESCRIPTION = "Explore FixedPriceFlow storage submissions indexed from Conflux eSpace Testnet."

function readProjectFile(path: string) {
	return readFileSync(resolve(process.cwd(), path))
}

describe("brand assets", () => {
	it("pins official Conflux eSpace assets and removes the prototype favicon", () => {
		for (const [name, expectedHash] of Object.entries(PUBLIC_ASSET_HASHES)) {
			const path = resolve(process.cwd(), "public", name)
			expect(existsSync(path), `${name} should exist`).toBe(true)
			const actualHash = createHash("sha256").update(readFileSync(path)).digest("hex")
			expect(actualHash, `${name} should match the pinned upstream asset`).toBe(expectedHash)
		}

		expect(existsSync(resolve(process.cwd(), "public/favicon.svg"))).toBe(false)
	})

	it("publishes product metadata before React loads", () => {
		const html = readProjectFile("index.html").toString("utf8")

		expect(html).toContain("<title>Conflux Storage Explorer — Conflux Storage Scan</title>")
		expect(html).toContain(`<meta name="description" content="${DESCRIPTION}" />`)
		expect(html).toContain('<meta name="theme-color" content="#F0F4F3" />')
		expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />')
		expect(html).toContain('<link rel="apple-touch-icon" href="/logo192.png" />')
		expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
	})

	it("provides install metadata using the pinned icons", () => {
		const manifestPath = resolve(process.cwd(), "public/manifest.webmanifest")
		expect(existsSync(manifestPath)).toBe(true)

		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
		expect(manifest).toEqual({
			background_color: "#F0F4F3",
			description: DESCRIPTION,
			display: "standalone",
			icons: [
				{
					sizes: "192x192",
					src: "/logo192.png",
					type: "image/png",
				},
				{
					sizes: "512x512",
					src: "/logo512.png",
					type: "image/png",
				},
			],
			name: "Conflux Storage Scan",
			short_name: "Storage Scan",
			start_url: "/",
			theme_color: "#F0F4F3",
		})
	})
})

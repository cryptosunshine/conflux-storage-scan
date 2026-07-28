import { defineConfig, devices } from "@playwright/test"

const host = "127.0.0.1"
const port = 4173

export default defineConfig({
	expect: {
		timeout: 10_000,
	},
	forbidOnly: true,
	fullyParallel: true,
	outputDir: "test-results",
	projects: [
		{
			name: "desktop-chromium",
			testIgnore: /mobile\.spec\.ts/,
			use: {
				...devices["Desktop Chrome"],
			},
		},
		{
			name: "mobile-chromium",
			testMatch: /mobile\.spec\.ts/,
			use: {
				...devices["iPhone 13"],
				browserName: "chromium",
			},
		},
	],
	reporter: [["list"], ["html", { open: "never" }]],
	retries: 0,
	testDir: "./tests/e2e",
	timeout: 30_000,
	use: {
		baseURL: `http://${host}:${port}`,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: `VITE_DATA_SOURCE=fixture corepack pnpm exec vite --mode test --host ${host} --port ${port}`,
		reuseExistingServer: false,
		stderr: "pipe",
		stdout: "pipe",
		timeout: 120_000,
		url: `http://${host}:${port}`,
	},
	workers: 2,
})

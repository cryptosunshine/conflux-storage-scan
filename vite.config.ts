import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import { STORAGE_NODE_UPSTREAM_URLS } from "./src/storage/config"

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "react" }),
		nodePolyfills({
			include: ["buffer", "crypto", "events", "stream", "util"],
		}),
		tailwindcss(),
		react(),
	],
	server: {
		proxy: Object.fromEntries(
			STORAGE_NODE_UPSTREAM_URLS.map((upstream, index) => [
				`/api/storage-node/${index}`,
				{
					changeOrigin: true,
					secure: true,
					target: upstream,
				},
			]),
		),
	},
})

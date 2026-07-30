import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "react" }),
		nodePolyfills({
			include: ["buffer", "crypto", "events", "stream", "util"],
		}),
		tailwindcss(),
		react(),
	],
})

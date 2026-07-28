import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/app"
import { storageDataSource } from "./app/data-source"
import { AppProviders } from "./app/providers"
import "./styles/index.css"

const root = document.getElementById("root")

if (!root) {
	throw new Error("Missing #root application mount")
}

createRoot(root).render(
	<StrictMode>
		<AppProviders dataSource={storageDataSource}>
			<App />
		</AppProviders>
	</StrictMode>,
)

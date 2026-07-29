import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import { App } from "./app/app"
import { storageDataSource } from "./app/data-source"
import { AppProviders } from "./app/providers"
import { createAppI18n } from "./i18n/i18n"
import "./styles/index.css"

const root = document.getElementById("root")

if (!root) {
	throw new Error("Missing #root application mount")
}

async function renderApplication() {
	const i18n = await createAppI18n()
	createRoot(root as HTMLElement).render(
		<StrictMode>
			<I18nextProvider i18n={i18n}>
				<AppProviders dataSource={storageDataSource}>
					<App />
				</AppProviders>
			</I18nextProvider>
		</StrictMode>,
	)
}

void renderApplication()

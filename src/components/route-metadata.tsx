import { useRouterState } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

const ADDRESS_TITLE_PATTERN = /^\/address\/([^/]+)$/
const SUBMISSION_TITLE_PATTERN = /^\/submission\/([^/]+)$/

export function shortenMetadataAddress(address: string) {
	return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function RouteMetadata() {
	const pathname = useRouterState({ select: (state) => state.location.pathname })
	const { t } = useTranslation("common")
	const addressMatch = ADDRESS_TITLE_PATTERN.exec(pathname)
	const submissionMatch = SUBMISSION_TITLE_PATTERN.exec(pathname)

	let title: string
	if (pathname === "/") {
		title = t("metadata.title.overview")
	} else if (pathname === "/submissions") {
		title = t("metadata.title.submissions")
	} else if (submissionMatch) {
		title = t("metadata.title.submission", { sequence: submissionMatch[1] })
	} else if (addressMatch) {
		title = t("metadata.title.address", {
			address: shortenMetadataAddress(addressMatch[1] ?? ""),
		})
	} else if (pathname === "/history") {
		title = t("metadata.title.history")
	} else if (pathname === "/analytics") {
		title = t("metadata.title.analytics")
	} else if (pathname === "/storage") {
		title = t("metadata.title.storage")
	} else {
		title = t("metadata.title.explorer")
	}
	const description = t("metadata.description")

	useEffect(() => {
		document.title = title
		document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", description)
	}, [description, title])

	return null
}

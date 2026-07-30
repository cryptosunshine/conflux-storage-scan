import { createFileRoute } from "@tanstack/react-router"
import { StoragePage } from "../features/storage-poc/storage-page"

export const Route = createFileRoute("/storage")({
	component: StoragePage,
})

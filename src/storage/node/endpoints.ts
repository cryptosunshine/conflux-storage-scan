import { STORAGE_NODE_UPSTREAM_URLS } from "../config"

export interface StorageNodeEndpoint {
	readonly hostname: string
	readonly index: number
	readonly ip: string
}

export const STORAGE_NODE_ENDPOINTS: readonly StorageNodeEndpoint[] = STORAGE_NODE_UPSTREAM_URLS.map((url, index) => {
	const hostname = new URL(url).hostname
	return {
		hostname,
		index,
		ip: hostname,
	}
})

export function resolveStorageNodeEndpoint(clientUrl: string): StorageNodeEndpoint | null {
	const upstreamIndex = STORAGE_NODE_UPSTREAM_URLS.indexOf(clientUrl as (typeof STORAGE_NODE_UPSTREAM_URLS)[number])
	if (upstreamIndex >= 0) {
		return STORAGE_NODE_ENDPOINTS[upstreamIndex] ?? null
	}

	for (const endpoint of STORAGE_NODE_ENDPOINTS) {
		if (clientUrl.includes(endpoint.hostname)) {
			return endpoint
		}
	}

	return null
}

export function resolveStorageNodeRoute(clientUrl: string): string {
	return clientUrl
}

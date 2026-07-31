import { STORAGE_NODE_PROXY_ROUTE_PREFIX, STORAGE_NODE_UPSTREAM_URLS } from "../config"

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
	const proxyMatch = /\/api\/storage-node\/(\d+)\/?$/.exec(clientUrl)
	if (proxyMatch) {
		return STORAGE_NODE_ENDPOINTS[Number(proxyMatch[1])] ?? null
	}

	const upstreamIndex = STORAGE_NODE_UPSTREAM_URLS.indexOf(clientUrl as (typeof STORAGE_NODE_UPSTREAM_URLS)[number])
	if (upstreamIndex >= 0) {
		return STORAGE_NODE_ENDPOINTS[upstreamIndex] ?? null
	}

	for (const endpoint of STORAGE_NODE_ENDPOINTS) {
		if (clientUrl.includes(endpoint.hostname)) {
			return endpoint
		}
	}

	if (clientUrl.startsWith(`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/`)) {
		const index = Number.parseInt(clientUrl.slice(`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/`.length), 10)
		return STORAGE_NODE_ENDPOINTS[index] ?? null
	}

	return null
}

export function resolveStorageNodeDisplayHostname(clientUrl: string): string {
	const endpoint = resolveStorageNodeEndpoint(clientUrl)
	if (endpoint) {
		return endpoint.hostname
	}

	try {
		return new URL(clientUrl).hostname
	} catch {
		return clientUrl
	}
}

export function resolveStorageNodeRoute(clientUrl: string, protocol = readPageProtocol()): string {
	if (clientUrl.startsWith("/")) {
		return clientUrl
	}
	const endpoint = resolveStorageNodeEndpoint(clientUrl)
	if (endpoint && (protocol === "https:" || protocol === "http:")) {
		return `${STORAGE_NODE_PROXY_ROUTE_PREFIX}/${endpoint.index}`
	}
	return clientUrl
}

function readPageProtocol(): string {
	const maybeLocation = (globalThis as { location?: { protocol?: string } }).location
	return maybeLocation?.protocol ?? "http:"
}

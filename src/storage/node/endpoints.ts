import { STORAGE_NODE_PROXY_ROUTE_PREFIX, STORAGE_NODE_UPSTREAM_URLS } from "../config"

export interface StorageNodeEndpoint {
	readonly hostname: string
	readonly index: number
	readonly ip: string
}

export const STORAGE_NODE_ENDPOINTS: readonly StorageNodeEndpoint[] = [
	{ hostname: "zgs-node-0.codekb.dev", index: 0, ip: "47.84.225.228" },
	{ hostname: "zgs-node-1.codekb.dev", index: 1, ip: "47.84.224.253" },
] as const

export function resolveStorageNodeEndpoint(clientUrl: string): StorageNodeEndpoint | null {
	const proxyMatch = /\/api\/storage-node\/(\d+)\/?$/.exec(clientUrl)
	if (proxyMatch) {
		return STORAGE_NODE_ENDPOINTS[Number(proxyMatch[1])] ?? null
	}

	const upstreamIndex = STORAGE_NODE_UPSTREAM_URLS.findIndex((url) => url === clientUrl)
	if (upstreamIndex >= 0) {
		return STORAGE_NODE_ENDPOINTS[upstreamIndex] ?? null
	}

	for (const endpoint of STORAGE_NODE_ENDPOINTS) {
		if (clientUrl.includes(endpoint.ip) || clientUrl.includes(endpoint.hostname)) {
			return endpoint
		}
	}

	if (clientUrl.startsWith(`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/`)) {
		const index = Number.parseInt(clientUrl.slice(`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/`.length), 10)
		return STORAGE_NODE_ENDPOINTS[index] ?? null
	}

	return null
}

export function resolveStorageNodeRoute(clientUrl: string, protocol = readPageProtocol()): string {
	if (clientUrl.startsWith("/")) {
		return clientUrl
	}
	const endpoint = resolveStorageNodeEndpoint(clientUrl)
	if (endpoint && protocol === "https:") {
		return `${STORAGE_NODE_PROXY_ROUTE_PREFIX}/${endpoint.index}`
	}
	return clientUrl
}

function readPageProtocol(): string {
	const maybeLocation = (globalThis as { location?: { protocol?: string } }).location
	return maybeLocation?.protocol ?? "http:"
}

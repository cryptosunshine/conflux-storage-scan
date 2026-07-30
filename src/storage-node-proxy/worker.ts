import {
	STORAGE_NODE_PROXY_ALLOWED_METHODS,
	STORAGE_NODE_PROXY_ROUTE_PREFIX,
	STORAGE_NODE_UPSTREAM_URLS,
} from "../storage/config"
import { handleStorageNodeProxy } from "./handler"

export interface StorageNodeProxyWorkerEnv {
	readonly ASSETS: {
		fetch(request: Request): Promise<Response>
	}
}

export default {
	async fetch(request: Request, env: StorageNodeProxyWorkerEnv): Promise<Response> {
		const url = new URL(request.url)
		if (url.pathname.startsWith(`${STORAGE_NODE_PROXY_ROUTE_PREFIX}/`)) {
			return handleStorageNodeProxy(request, {
				config: {
					allowedMethods: STORAGE_NODE_PROXY_ALLOWED_METHODS,
					routePrefix: STORAGE_NODE_PROXY_ROUTE_PREFIX,
					upstreamUrls: STORAGE_NODE_UPSTREAM_URLS,
				},
				fetch,
			})
		}
		return env.ASSETS.fetch(request)
	},
}

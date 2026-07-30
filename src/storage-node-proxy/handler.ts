export interface StorageNodeProxyConfig {
	readonly allowedMethods: ReadonlySet<string>
	readonly routePrefix: string
	readonly upstreamUrls: readonly string[]
}

export interface StorageNodeProxyDependencies {
	readonly config: StorageNodeProxyConfig
	readonly fetch: typeof fetch
	readonly validateUpstream?: (urls: readonly string[]) => string | null
}

interface JsonRpcEnvelope {
	readonly id?: unknown
	readonly jsonrpc?: unknown
	readonly method?: unknown
	readonly params?: unknown
}

function jsonError(status: number, message: string): Response {
	return Response.json({ error: message }, { status })
}

function parseNodeIndex(pathname: string, routePrefix: string, upstreamCount: number): number | null {
	const prefix = `${routePrefix}/`
	if (!pathname.startsWith(prefix)) {
		return null
	}
	const indexText = pathname.slice(prefix.length).replace(/\/$/, "")
	if (!/^\d+$/.test(indexText)) {
		return null
	}
	const index = Number.parseInt(indexText, 10)
	if (!Number.isSafeInteger(index) || index < 0 || index >= upstreamCount) {
		return null
	}
	return index
}

function parseJsonRpcBody(body: unknown): JsonRpcEnvelope | null {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return null
	}
	return body as JsonRpcEnvelope
}

export async function handleStorageNodeProxy(
	request: Request,
	{ config, fetch, validateUpstream }: StorageNodeProxyDependencies,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonError(405, "Storage Node proxy accepts POST only")
	}

	const upstreamBlocker = validateUpstream?.(config.upstreamUrls) ?? null
	if (upstreamBlocker) {
		return jsonError(502, upstreamBlocker)
	}

	const nodeIndex = parseNodeIndex(new URL(request.url).pathname, config.routePrefix, config.upstreamUrls.length)
	if (nodeIndex === null) {
		return jsonError(404, "Unknown Storage Node proxy route")
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return jsonError(400, "Storage Node proxy expects valid JSON")
	}

	const envelope = parseJsonRpcBody(body)
	if (
		envelope?.jsonrpc !== "2.0" ||
		typeof envelope.method !== "string" ||
		!Array.isArray(envelope.params) ||
		!("id" in envelope)
	) {
		return jsonError(400, "Storage Node proxy expects a JSON-RPC 2.0 request")
	}
	if (!config.allowedMethods.has(envelope.method)) {
		return jsonError(403, "Storage Node proxy method is not allowed")
	}

	const upstream = config.upstreamUrls[nodeIndex]
	let upstreamResponse: Response
	try {
		upstreamResponse = await fetch(upstream, {
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
			},
			method: "POST",
		})
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : "unknown error"
		return jsonError(502, `Storage Node upstream request failed for ${upstream}: ${detail}`)
	}

	if (upstreamResponse.status === 403) {
		const blockedBody = await upstreamResponse.clone().text()
		if (blockedBody.includes("1003")) {
			return jsonError(
				502,
				`Cloudflare blocked direct IP access to ${upstream}. Configure STORAGE_NODE_UPSTREAM_URLS with DNS-only hostname URLs.`,
			)
		}
	}

	return new Response(upstreamResponse.body, {
		headers: {
			"Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json",
		},
		status: upstreamResponse.status,
	})
}

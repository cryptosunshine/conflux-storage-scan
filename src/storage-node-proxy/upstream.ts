import { STORAGE_NODE_UPSTREAM_URLS } from "../storage/config"

export function isDirectIpUrl(url: string): boolean {
	try {
		const hostname = new URL(url).hostname
		return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
	} catch {
		return false
	}
}

export function parseStorageNodeWorkerUpstreamUrls(
	raw: string | undefined,
	fallback: readonly string[] = STORAGE_NODE_UPSTREAM_URLS,
): readonly string[] {
	if (raw === undefined || raw.trim() === "") {
		return fallback
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new Error("STORAGE_NODE_UPSTREAM_URLS must be a JSON string array")
	}

	if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((url) => typeof url !== "string")) {
		throw new Error("STORAGE_NODE_UPSTREAM_URLS must be a non-empty JSON string array")
	}

	return parsed
}

export function describeDirectIpUpstreamBlocker(urls: readonly string[]): string | null {
	const directIpUrls = urls.filter(isDirectIpUrl)
	if (directIpUrls.length === 0) {
		return null
	}
	return `Cloudflare Workers cannot fetch direct IP addresses (${directIpUrls.join(", ")}). Set STORAGE_NODE_UPSTREAM_URLS to HTTPS hostname URLs.`
}

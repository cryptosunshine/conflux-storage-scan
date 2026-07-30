export const STORAGE_CHUNK_BYTES = 256
export const STORAGE_SEGMENT_CHUNKS = 1024
export const STORAGE_SEGMENT_BYTES = STORAGE_CHUNK_BYTES * STORAGE_SEGMENT_CHUNKS
export const STORAGE_POC_MAX_FILE_BYTES = 100 * 1024 * 1024
export const STORAGE_NODE_TIMEOUT_MS = 5_000
export const STORAGE_NODE_SYNC_TIMEOUT_MS = 5 * 60_000
export const STORAGE_NODE_POLL_INTERVAL_MS = 1_000
export const STORAGE_UPLOAD_CONFIRM_TIMEOUT_MS = 30_000
export const STORAGE_NODE_MAX_BLOCK_LAG = 512n
export const STORAGE_UPLOAD_CONCURRENCY = 2
export const STORAGE_UPLOAD_MAX_ATTEMPTS = 3

export const STORAGE_NODE_UPSTREAM_URLS = ["http://47.84.225.228:5678", "http://47.84.224.253:5678"] as const
export const STORAGE_NODE_PROXY_ROUTE_PREFIX = "/api/storage-node" as const
export const STORAGE_NODE_PROXY_ALLOWED_METHODS = new Set([
	"zgs_downloadSegmentByTxSeq",
	"zgs_getFileInfo",
	"zgs_getFileInfoByTxSeq",
	"zgs_getShardConfig",
	"zgs_getStatus",
	"zgs_uploadSegmentsByTxSeq",
])

/** @deprecated Use {@link STORAGE_NODE_UPSTREAM_URLS} for server-side probes. */
export const CONFLUX_STORAGE_NODE_URLS = STORAGE_NODE_UPSTREAM_URLS

export function resolveStorageNodeClientUrls(protocol = readPageProtocol()): readonly string[] {
	if (protocol === "https:") {
		return STORAGE_NODE_UPSTREAM_URLS.map((_, index) => `${STORAGE_NODE_PROXY_ROUTE_PREFIX}/${index}`)
	}
	return STORAGE_NODE_UPSTREAM_URLS
}

function readPageProtocol(): string {
	const maybeLocation = (globalThis as { location?: { protocol?: string } }).location
	return maybeLocation?.protocol ?? "http:"
}

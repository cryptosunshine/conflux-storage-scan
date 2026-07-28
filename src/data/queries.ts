import { type QueryClient, queryOptions } from "@tanstack/react-query"
import type { StorageDataSource } from "./storage-data-source"

export const storageKeys = {
	all: ["storage"] as const,
	summary: () => [...storageKeys.all, "summary"] as const,
	submissionsRoot: () => [...storageKeys.all, "submissions"] as const,
	submissions: (page: number) => [...storageKeys.submissionsRoot(), page] as const,
	submission: (sequence: string) => [...storageKeys.all, "submission", sequence] as const,
	addressRoot: () => [...storageKeys.all, "address"] as const,
	address: (address: string, page: number) => [...storageKeys.addressRoot(), address.toLowerCase(), page] as const,
}

export function createStorageQueries(dataSource: StorageDataSource) {
	return {
		summary: () =>
			queryOptions({
				queryKey: storageKeys.summary(),
				queryFn: () => dataSource.getSummary(),
			}),
		submissions: (page: number) =>
			queryOptions({
				queryKey: storageKeys.submissions(page),
				queryFn: () => dataSource.listSubmissions({ page }),
			}),
		submission: (sequence: string) =>
			queryOptions({
				queryKey: storageKeys.submission(sequence),
				queryFn: () => dataSource.getSubmission(BigInt(sequence)),
			}),
		address: (address: string, page: number) =>
			queryOptions({
				queryKey: storageKeys.address(address, page),
				queryFn: () =>
					dataSource.listBySubmitter({
						page,
						submitter: address,
					}),
			}),
	}
}

export async function invalidateStorageAfterSync(
	queryClient: QueryClient,
	affectedSubmitters: readonly string[] = [],
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: storageKeys.summary() }),
		queryClient.invalidateQueries({
			queryKey: storageKeys.submissionsRoot(),
		}),
		...affectedSubmitters.map((address) =>
			queryClient.invalidateQueries({
				queryKey: storageKeys.addressRoot(),
				predicate: (query) => query.queryKey[2] === address.toLowerCase(),
			}),
		),
	])
}

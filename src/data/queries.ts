import { type QueryClient, queryOptions } from "@tanstack/react-query"
import type { StorageDataSource } from "./storage-data-source"

export const storageKeys = {
	all: ["storage"] as const,
	sync: () => [...storageKeys.all, "sync"] as const,
	summary: () => [...storageKeys.all, "summary"] as const,
	analytics: () => [...storageKeys.all, "analytics"] as const,
	submissionsRoot: () => [...storageKeys.all, "submissions"] as const,
	submissions: (page: number, pageSize = 20) => [...storageKeys.submissionsRoot(), page, pageSize] as const,
	submissionRoot: () => [...storageKeys.all, "submission"] as const,
	submission: (sequence: string) => [...storageKeys.all, "submission", sequence] as const,
	addressRoot: () => [...storageKeys.all, "address"] as const,
	address: (address: string, page: number) => [...storageKeys.addressRoot(), address.toLowerCase(), page] as const,
	addressSummary: (address: string) => [...storageKeys.addressRoot(), address.toLowerCase(), "summary"] as const,
}

export function keepPreviousAddressPage<Item>(
	address: string,
	previousData: Item | undefined,
	previousQuery: { readonly queryKey: readonly unknown[] } | undefined,
): Item | undefined {
	return previousQuery?.queryKey[2] === address.toLowerCase() ? previousData : undefined
}

export function createStorageQueries(dataSource: StorageDataSource) {
	return {
		analytics: () =>
			queryOptions({
				queryKey: storageKeys.analytics(),
				queryFn: () => dataSource.getAnalyticsTimeline(),
			}),
		summary: () =>
			queryOptions({
				queryKey: storageKeys.summary(),
				queryFn: () => dataSource.getSummary(),
			}),
		submissions: (page: number, pageSize = 20) =>
			queryOptions({
				queryKey: storageKeys.submissions(page, pageSize),
				queryFn: () => dataSource.listSubmissions({ page, pageSize }),
			}),
		submission: (sequence: string) =>
			queryOptions({
				queryKey: storageKeys.submission(sequence),
				queryFn: async () => (await dataSource.getSubmission(BigInt(sequence))) ?? null,
			}),
		addressSummary: (address: string) =>
			queryOptions({
				queryKey: storageKeys.addressSummary(address),
				queryFn: () => dataSource.getSubmitterSummary(address),
			}),
		address: (address: string, page: number) =>
			queryOptions({
				queryKey: storageKeys.address(address, page),
				queryFn: () =>
					dataSource.listBySubmitter({
						page,
						pageSize: 20,
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
		queryClient.invalidateQueries({ queryKey: storageKeys.analytics() }),
		queryClient.invalidateQueries({ queryKey: storageKeys.summary() }),
		queryClient.invalidateQueries({
			queryKey: storageKeys.submissionsRoot(),
		}),
		queryClient.invalidateQueries({
			queryKey: storageKeys.submissionRoot(),
		}),
		...affectedSubmitters.map((address) =>
			queryClient.invalidateQueries({
				queryKey: storageKeys.addressRoot(),
				predicate: (query) => query.queryKey[2] === address.toLowerCase(),
			}),
		),
	])
}

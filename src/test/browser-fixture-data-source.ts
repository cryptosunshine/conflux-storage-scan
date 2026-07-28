import acceptedSubmissions from "../../tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1/expected/submissions.json"
import acceptedSummary from "../../tests/fixtures/rpc/conflux-espace-testnet/fixed-price-flow/v1/expected/summary.json"
import type { SyncState } from "../chain/sync/sync-submissions"
import { createFixtureDataSourceFromJson } from "../data/fixture-data-source"
import type { AddressListSubmissionsQuery, ListSubmissionsQuery, StorageDataSource } from "../data/storage-data-source"

type FixtureState = "normal" | "rpc-error" | "stale-once"

function requestedFixtureState(): FixtureState {
	const value = new URLSearchParams(window.location.search).get("fixtureState")
	return value === "rpc-error" || value === "stale-once" ? value : "normal"
}

class BrowserFixtureDataSource implements StorageDataSource {
	readonly #delegate: StorageDataSource
	readonly #fixtureState: FixtureState
	#syncAttempts = 0
	#state: SyncState = { status: "idle" }

	constructor(delegate: StorageDataSource, fixtureState: FixtureState) {
		this.#delegate = delegate
		this.#fixtureState = fixtureState
	}

	async sync(signal?: AbortSignal): Promise<SyncState> {
		this.#syncAttempts += 1
		const fresh = await this.#delegate.sync(signal)
		if (this.#fixtureState === "rpc-error" || (this.#fixtureState === "stale-once" && this.#syncAttempts <= 2)) {
			this.#state = {
				error: {
					code: "RPC_TIMEOUT",
					message: "Fixture RPC timed out. Cached submissions remain available.",
				},
				lastSuccessAt: Date.UTC(2026, 6, 28, 2, 40, 41),
				status: "stale",
			}
			return this.#state
		}
		this.#state = fresh
		return this.#state
	}

	getSyncState(): SyncState {
		return this.#state
	}

	getAnalyticsTimeline(asOfTimestamp?: number) {
		return this.#delegate.getAnalyticsTimeline(asOfTimestamp)
	}

	getSummary() {
		return this.#delegate.getSummary()
	}

	getSubmitterSummary(submitter: string) {
		return this.#delegate.getSubmitterSummary(submitter)
	}

	listSubmissions(query?: ListSubmissionsQuery) {
		return this.#delegate.listSubmissions(query)
	}

	getSubmission(sequence: bigint) {
		return this.#delegate.getSubmission(sequence)
	}

	listBySubmitter(query: AddressListSubmissionsQuery) {
		return this.#delegate.listBySubmitter(query)
	}

	async rebuildLocalIndex(): Promise<void> {
		await this.#delegate.rebuildLocalIndex()
		this.#state = { status: "idle" }
		this.#syncAttempts = 0
	}
}

export function createBrowserFixtureDataSource(): StorageDataSource {
	return new BrowserFixtureDataSource(
		createFixtureDataSourceFromJson({
			allocatedSectorCount: BigInt(acceptedSummary.state.currentLength),
			contractSubmissionCount: BigInt(acceptedSummary.state.submissionIndex),
			headBlock: BigInt(acceptedSummary.headBlock.number),
			submissions: acceptedSubmissions,
		}),
		requestedFixtureState(),
	)
}

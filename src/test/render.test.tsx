import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useStoragePocRuntime } from "../app/providers"
import { createFixtureDataSource } from "../data/fixture-data-source"
import { createStoragePocFixtureRuntime } from "../storage/runtime-fixture"
import { renderWithDataSource } from "./render"

describe("renderWithDataSource", () => {
	it("injects the selected storage POC runtime", async () => {
		const runtime = createStoragePocFixtureRuntime()
		const dataSource = createFixtureDataSource({
			allocatedSectorCount: 0n,
			contractSubmissionCount: 0n,
			submissions: [],
		})

		function RuntimeProbe() {
			const selectedRuntime = useStoragePocRuntime()
			return <output>{selectedRuntime === runtime ? "injected runtime" : "wrong runtime"}</output>
		}

		await renderWithDataSource(<RuntimeProbe />, dataSource, {
			storagePocRuntime: runtime,
		})

		expect(screen.getByText("injected runtime")).toBeInTheDocument()
	})
})

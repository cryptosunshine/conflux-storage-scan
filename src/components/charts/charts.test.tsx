import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { StorageTimelinePoint } from "../../analytics/types"
import { StorageGrowthChart } from "./storage-growth-chart"
import { SubmissionActivityChart } from "./submission-activity-chart"

const points: readonly StorageTimelinePoint[] = [
	{
		allocatedBytes: 8_192n,
		allocatedSectorCount: 32n,
		cumulativeLogicalBytes: 4_096n,
		cumulativeSubmissionCount: 1n,
		dailyLogicalBytes: 4_096n,
		dailySubmissionCount: 1n,
		date: "2026-07-01",
	},
	{
		allocatedBytes: 16_384n,
		allocatedSectorCount: 64n,
		cumulativeLogicalBytes: 10_240n,
		cumulativeSubmissionCount: 3n,
		dailyLogicalBytes: 6_144n,
		dailySubmissionCount: 2n,
		date: "2026-07-02",
	},
]

describe("storage analytics charts", () => {
	it("gives the storage chart a visible summary, named series, and exact daily values", () => {
		render(<StorageGrowthChart points={points} />)

		expect(screen.getByRole("heading", { name: "Indexed storage growth" })).toBeInTheDocument()
		expect(screen.getByText(/logical data reached 10 KiB/i)).toBeInTheDocument()
		expect(screen.getByText("Logical data")).toBeInTheDocument()
		expect(screen.getByText("Allocated storage")).toBeInTheDocument()

		const table = screen.getByRole("table", { name: "Indexed storage growth daily values" })
		expect(within(table).getByText("Jul 2, 2026")).toBeInTheDocument()
		expect(within(table).getByText("10 KiB")).toBeInTheDocument()
		expect(within(table).getByText("16 KiB")).toBeInTheDocument()
	})

	it("expresses daily and cumulative submission activity without forbidden product concepts", () => {
		render(<SubmissionActivityChart points={points} />)

		expect(screen.getByRole("heading", { name: "Daily submission activity" })).toBeInTheDocument()
		expect(screen.getByText(/2 submissions on jul 2, 2026/i)).toBeInTheDocument()
		expect(screen.getByText("Daily submissions")).toBeInTheDocument()
		expect(screen.getByText("Cumulative submissions")).toBeInTheDocument()

		const table = screen.getByRole("table", { name: "Daily submission activity values" })
		expect(within(table).getByText("3")).toBeInTheDocument()
		expect(screen.queryByText(/mining|reward|gas|download|[1-9][0-9.]* CFX/i)).not.toBeInTheDocument()
	})
})

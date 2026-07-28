import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "../app/app"

describe("App", () => {
	it("renders the product name", () => {
		render(<App />)

		expect(screen.getByText("Conflux Storage Scan")).toBeInTheDocument()
	})
})

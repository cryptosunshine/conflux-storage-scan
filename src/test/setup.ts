import "@testing-library/jest-dom/vitest"
import "fake-indexeddb/auto"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

class TestResizeObserver {
	readonly #callback: ResizeObserverCallback

	constructor(callback: ResizeObserverCallback) {
		this.#callback = callback
	}

	disconnect() {}

	observe(target: Element) {
		const contentRect = {
			bottom: 300,
			height: 300,
			left: 0,
			right: 720,
			toJSON: () => ({}),
			top: 0,
			width: 720,
			x: 0,
			y: 0,
		} satisfies DOMRectReadOnly
		this.#callback([{ contentRect, target } as ResizeObserverEntry], this as unknown as ResizeObserver)
	}

	unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

afterEach(cleanup)

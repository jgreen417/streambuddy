import { afterEach, expect, it, vi } from "vitest"
import * as browser from "webextension-polyfill"
const handlers = new Map<string, (message: { data: { url: string; type: string } }) => Promise<unknown>>()
vi.mock("webext-bridge/background", () => ({
	onMessage: (name: string, callback: (message: { data: { url: string; type: string } }) => Promise<unknown>) =>
		handlers.set(name, callback),
}))
const realFetch = globalThis.fetch
afterEach(() => {
	globalThis.fetch = realFetch
	vi.restoreAllMocks()
	vi.useRealTimers()
})
it.each(["timeout", "broken body", "malformed JSON"])(
	"classifies %s in the background response and error channel",
	async (scenario) => {
		vi.useFakeTimers()
		Object.assign(browser.runtime, { onInstalled: { addListener: vi.fn() } })
		Object.assign(browser, {
			alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
			tabs: { create: vi.fn() },
		})
		const errors = vi.spyOn(console, "error").mockImplementation(() => {})
		globalThis.fetch = vi.fn(() =>
			scenario === "timeout"
				? new Promise<Response>(() => {})
				: scenario === "malformed JSON"
					? Promise.resolve(new Response("{"))
					: Promise.resolve(
							new Response(
								new ReadableStream({
									start(controller) {
										controller.error(new TypeError("Network body interrupted"))
									},
								}),
							),
						),
		)
		await import("@/background/index")
		const pending = handlers.get("fetch")!({
			data: { url: "https://api.themoviedb.org/3/configuration", type: "noAuth" },
		})
		const result = pending.then((value) => value)
		await vi.advanceTimersByTimeAsync(10_001)
		if (scenario === "malformed JSON") {
			expect(await result).toEqual({ error: expect.any(String) })
			expect(errors).toHaveBeenCalledOnce()
		} else {
			expect(await result).toEqual({
				error: scenario === "timeout" ? "Request timed out" : "Network response interrupted",
			})
			expect(errors).not.toHaveBeenCalled()
		}
	},
)

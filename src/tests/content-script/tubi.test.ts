import { afterEach, describe, expect, it, vi } from "vitest"
import { parseTubiTitle, playingTubiTitle } from "../../playback/sites/tubi"

describe("Tubi page data", () => {
	const page = (data: string) => `<div></div><script>window.__data=${data};</script><script>other()</script>`

	it("reads a title's credits start and ad breaks past the bare undefined values Tubi writes", () => {
		const html = page(
			`{"auth":{"userCredentials":undefined},"video":{"byId":{"516375":{"title":"Bloodsport","credit_cuepoints":{"postlude":5351,"intro_end":0},"monetization":{"cue_points":[0,797,1299]},"tags":[undefined]}}}}`,
		)
		expect(parseTubiTitle(html, "516375")).toEqual({ postlude: 5351, adBreaks: [797, 1299] })
	})

	it("says nothing for a title the page doesn't hold, or for data it can't read", () => {
		const html = page(`{"video":{"byId":{"516375":{"credit_cuepoints":{"postlude":0}}}}}`)
		expect(parseTubiTitle(html, "592905")).toBeNull()
		expect(parseTubiTitle(html, "516375")).toEqual({ postlude: undefined, adBreaks: [] })
		expect(parseTubiTitle(page("{oops"), "516375")).toBeNull()
		expect(parseTubiTitle("<html></html>", "516375")).toBeNull()
	})

	it("reads the object alone when spaced out or followed by more script in the same tag", () => {
		const html = `<script>window.__data = {"video":{"byId":{"516375":{"title":"a } \\" {","credit_cuepoints":{"postlude":5351},"monetization":{"cue_points":[797]}}}}, "x": undefined };window.__ready=true;</script>`
		expect(parseTubiTitle(html, "516375")).toEqual({ postlude: 5351, adBreaks: [797] })
	})
})

describe("Tubi page data for a title moved on to", () => {
	afterEach(() => vi.unstubAllGlobals())

	it("gives up after a second failed fetch instead of loading the page every 30 seconds", async () => {
		vi.useFakeTimers()
		history.pushState(null, "", "/movies/700001/a-film")
		const fetch = vi.fn().mockResolvedValue(new Response("busy", { status: 503 }))
		vi.stubGlobal("fetch", fetch)
		for (let tick = 0; tick < 10; tick++) {
			playingTubiTitle()
			await vi.advanceTimersByTimeAsync(31_000)
		}
		expect(fetch).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})
})

import { describe, expect, it } from "vitest"
import { parseTubiTitle } from "../../playback/sites/tubi"

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
})

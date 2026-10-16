import { describe, expect, it } from "vitest"
import { parseNetflixCredits } from "../../utils/netflix-credits"

describe("Netflix credits marker", () => {
	it("reads where a film's credits start, as a share of its runtime", () => {
		// Red Notice: credits start 533s before the end of 7082s
		const credits = parseNetflixCredits({
			video: { title: "Red Notice", type: "movie", creditsOffset: 6549000, runtime: 7082000 },
		})
		expect(credits?.title).toBe("Red Notice")
		expect(credits?.movie).toBe(true)
		expect(credits!.creditsShare! * 7082).toBeCloseTo(533)
		// seconds work the same
		expect(
			parseNetflixCredits({ video: { title: "Nope", type: "movie", creditsOffset: 7668, runtime: 8060 } })!
				.creditsShare! * 8060,
		).toBeCloseTo(392)
	})
	it("has no marker when the offset is the whole runtime, or missing", () => {
		expect(
			parseNetflixCredits({ video: { title: "Animals", type: "movie", creditsOffset: 5400, runtime: 5400 } })
				?.creditsShare,
		).toBeUndefined()
		expect(parseNetflixCredits({ video: { title: "Animals", type: "movie" } })?.creditsShare).toBeUndefined()
	})
	it("tells shows apart from films, and ignores anything unexpected", () => {
		expect(parseNetflixCredits({ video: { title: "Stranger Things", type: "show" } })?.movie).toBe(false)
		expect(parseNetflixCredits(null)).toBeNull()
		expect(parseNetflixCredits({ video: {} })).toBeNull()
	})
})

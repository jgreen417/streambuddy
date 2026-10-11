import { describe, expect, it } from "vitest"
import { isBelowRatingCutoff } from "../../utils/row-presentation"

describe("rating cutoff", () => {
	it("uses each source's native band and keeps titles at the cutoff", () => {
		expect(isBelowRatingCutoff("letterboxd", 2.99, 2, 100, 4)).toBe(true)
		expect(isBelowRatingCutoff("letterboxd", 3, 2, 100, 4)).toBe(false)
		expect(isBelowRatingCutoff("imdb", 7.69, 2, 100, 4)).toBe(true)
		expect(isBelowRatingCutoff("imdb", 7.7, 2, 100, 4)).toBe(false)
	})
	it("keeps unknown scores and low-confidence TMDb fallbacks", () => {
		expect(isBelowRatingCutoff("imdb", 0, 4, 0, 4)).toBe(false)
		expect(isBelowRatingCutoff("tmdb", 2, 2, 10, 4)).toBe(false)
		expect(isBelowRatingCutoff("tmdb", 2, 2, 100, 4)).toBe(true)
		expect(isBelowRatingCutoff("letterboxd", NaN, 2, 100, 4)).toBe(false)
	})
})

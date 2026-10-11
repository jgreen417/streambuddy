import { describe, it, expect } from "vitest"
import { recentSeenTitles, type SeenTitle } from "../../utils/stats"
const film = (seen: string): SeenTitle => ({
	title: seen,
	seen,
	source: "imdb",
	rating: 8,
	url: "https://www.imdb.com/title/tt1/",
	platform: "netflix",
	media_type: "movie",
})
describe("recent discovery history", () => {
	it("excludes stale and future records without relying on a streaming-page cleanup", () => {
		const now = new Date(2026, 9, 12)
		const entries = {
			recent: film("2026-10-12"),
			edge: film("2026-10-06"),
			old: film("2026-10-05"),
			future: film("2026-10-13"),
		}
		expect(recentSeenTitles(entries, now).map((title) => title.seen)).toEqual(["2026-10-12", "2026-10-06"])
	})
})

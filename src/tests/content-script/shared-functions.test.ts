import { describe, it, expect, vi } from "vitest"
import { sendMessage } from "webext-bridge/content-script"
import { isCacheCurrent, lookupMovieInfo } from "../../content-script/cache"
import { settings } from "../../stores/settings"
import { titleFromLabel as Disney_titleFromLabel } from "../../content-script/sites/disney"
import { fixTitle as HBO_fixTitle } from "../../content-script/sites/max"
import { titleLink as Amazon_titleLink } from "../../content-script/sites/prime"
import { CheckedCards, isSeasonOnlyTitle, pickBestMatch } from "../../utils/tmdb"

describe("Disney_titleFromLabel", () => {
	// labels from Disney+'s home, title and brand pages
	it("strips badges, the network and everything after the title", () => {
		expect(
			Disney_titleFromLabel(
				"Hulu Original Series New Badge Rivals Rated TV-MA Released 2024. Drama Select for details on this title.",
			),
		).toBe("Rivals")
		expect(
			Disney_titleFromLabel(
				"New Movie Badge Oasis: Don't Look Back In Anger Hulu Original Series Select for details on this title.",
			),
		).toBe("Oasis: Don't Look Back In Anger")
		expect(
			Disney_titleFromLabel(
				"Season Finale Badge It's Always Sunny in Philadelphia FX Select for details on this title.",
			),
		).toBe("It's Always Sunny in Philadelphia")
		expect(Disney_titleFromLabel("Turning Red Disney+ Original Select for details on this title.")).toBe("Turning Red")
	})
	it("keeps the title of a part-watched film or episode", () => {
		expect(Disney_titleFromLabel("The Incredibles 1 hour 54 minutes remaining")).toBe("The Incredibles")
		expect(Disney_titleFromLabel("Glee Season 2 Episode 5 The Rocky Horror Glee Show Watch Next Episode")).toBe("Glee")
	})
})

describe("HBO_fixTitle", () => {
	it("strips bidi marks, the position and badges", () => {
		expect(
			HBO_fixTitle(
				"\u2066\u2068\u2068Weapons\u2069\u2069. \u20681 of 20\u2069. \u2068\u2068Leaving Soon\u2069\u2069\u2069",
			),
		).toBe("Weapons")
	})

	it("keeps full stops that are part of the title", () => {
		expect(
			HBO_fixTitle(
				"\u2066\u2068\u2068Freddy vs. Jason\u2069\u2069. \u20686 of 20\u2069. \u2068\u2068Just Added\u2069\u2069\u2069",
			),
		).toBe("Freddy vs. Jason")
	})

	it("handles the grid label on detail pages", () => {
		expect(
			HBO_fixTitle("\u2066\u2068\u2068American Sniper\u2069\u2069. \u2068Row 1 of 5, Column 1 of 6\u2069\u2069"),
		).toBe("American Sniper")
	})

	it("uses the whole label when there are no isolation marks", () => {
		expect(HBO_fixTitle("Mulholland Drive")).toBe("Mulholland Drive")
	})

	it("returns undefined without a label", () => {
		expect(HBO_fixTitle(null)).toBeUndefined()
		expect(HBO_fixTitle("")).toBeUndefined()
	})
})

describe("Amazon_titleLink", () => {
	const card = (html: string) => {
		const article = document.createElement("article")
		article.innerHTML = html
		return article
	}
	const badge = '<a id="rating" class="sb-card-rating" href="https://letterboxd.com/film/invincible/">4.1</a>'
	const link = '<a href="https://www.primevideo.com/detail/0ABC/" aria-label="Invincible"></a>'

	it("finds the title link", () => {
		expect(Amazon_titleLink(card(link))?.getAttribute("aria-label")).toBe("Invincible")
	})

	it("skips the badge when a re-render puts it before the title link", () => {
		expect(Amazon_titleLink(card(badge + link))?.getAttribute("aria-label")).toBe("Invincible")
	})

	it("has no title link on live cards", () => {
		expect(Amazon_titleLink(card('<a href="https://www.primevideo.com/live/0ABC/" aria-label="Live">'))).toBeUndefined()
	})
})

describe("pickBestMatch", () => {
	it("prefers an exact title match over TMDb's first result", () => {
		const results = [
			{ id: 1, title: "Dune: Part Two" },
			{ id: 2, title: "Dune" },
		]
		expect(pickBestMatch(results, "Dune").id).toBe(2)
	})

	it("ignores case, accents and punctuation", () => {
		const results = [
			{ id: 1, name: "Something Else" },
			{ id: 2, original_title: "Amélie" },
		]
		expect(pickBestMatch(results, "amelie").id).toBe(2)
		expect(pickBestMatch([{ id: 3, title: "Fast & Furious" }], "Fast and Furious").id).toBe(3)
	})

	it("keeps TMDb's top exact match unless another is far more watched", () => {
		const remakes = [
			{ id: 1, title: "Carrie", vote_count: 3000, popularity: 20 },
			{ id: 2, title: "Carrie", vote_count: 4000, popularity: 25 },
		]
		expect(pickBestMatch(remakes, "Carrie").id).toBe(1)
		const showFirst = [
			{ id: 3, name: "The Flash", vote_count: 300, popularity: 10 },
			{ id: 4, title: "The Flash", vote_count: 5000, popularity: 40 },
		]
		expect(pickBestMatch(showFirst, "The Flash").id).toBe(4)
	})

	it("treats superscripts like digits", () => {
		expect(
			pickBestMatch(
				[
					{ id: 1, title: "Other" },
					{ id: 9, title: "The Accountant 2" },
				],
				"The Accountant²",
			).id,
		).toBe(9)
	})

	it("skips unrated results when nothing matches exactly", () => {
		const starWars = [
			{ id: 1, title: "Cardboard Star Wars: A New Hope", vote_count: 0, popularity: 2 },
			{ id: 11, title: "Star Wars", vote_count: 21000, popularity: 60 },
		]
		expect(pickBestMatch(starWars, "Star Wars: A New Hope").id).toBe(11)
		const harryPotter = [
			{ id: 2, name: "Harry Potter", vote_count: 0, popularity: 90 },
			{ id: 671, title: "Harry Potter and the Sorcerer's Stone", vote_count: 28000, popularity: 50 },
		]
		expect(pickBestMatch(harryPotter, "Harry Potter and the Philosopher's Stone").id).toBe(671)
	})

	it("keeps an unrated first result when the rated ones are unrelated", () => {
		const newRelease = [
			{ id: 5, title: "Brand New Film (Director's Cut)", vote_count: 0 },
			{ id: 6, title: "Something Else Entirely", vote_count: 900 },
		]
		expect(pickBestMatch(newRelease, "Brand New Film").id).toBe(5)
		const shortTitle = [
			{ id: 5, title: "Brand New Film (Director's Cut)", vote_count: 0 },
			{ id: 7, title: "Film", vote_count: 900 },
		]
		expect(pickBestMatch(shortTitle, "Brand New Film").id).toBe(5)
	})

	it("falls back to the first result", () => {
		expect(
			pickBestMatch(
				[
					{ id: 7, title: "Close" },
					{ id: 8, title: "Other" },
				],
				"Clos",
			).id,
		).toBe(7)
		expect(pickBestMatch(undefined, "Anything")).toBeUndefined()
	})
})

describe("rating source policy", () => {
	it("labels a lookup with the sources it started under, even if the setting changes mid-lookup", async () => {
		settings.value.General.ratingSources = "both"
		let finishLetterboxd: (value: unknown) => void = () => {}
		vi.mocked(sendMessage).mockImplementation((async (name: string) => {
			if (name === "fetch")
				return { results: [{ id: 1, title: "Dune", media_type: "movie", vote_average: 8, vote_count: 900 }] }
			if (name === "letterboxdRating")
				return new Promise((resolve) => {
					finishLetterboxd = resolve
				})
			return null
		}) as never)
		const lookup = lookupMovieInfo("Dune", "movie", null)
		await vi.waitFor(() =>
			expect(sendMessage).toHaveBeenCalledWith("letterboxdRating", expect.anything(), "background"),
		)
		settings.value.General.ratingSources = "imdb"
		finishLetterboxd({ source: "letterboxd", rating: 4.1, rating_count: 10, url: "https://letterboxd.com/film/dune/" })
		const info = await lookup
		expect(info?.source).toBe("letterboxd")
		expect(info?.sources).toBe("both")
		expect(isCacheCurrent(info!)).toBe(false)
		settings.value.General.ratingSources = "both"
	})
})

describe("isSeasonOnlyTitle", () => {
	it("flags cards that only name a season", () => {
		for (const title of ["Season 1", "season 12", "Staffel 2", "Series 3", "Saison 1", "Temporada 4"])
			expect(isSeasonOnlyTitle(title)).toBe(true)
	})

	it("keeps real titles that mention a season", () => {
		for (const title of ["Code Red Season 1", "The Boys", "Season of the Witch", "1917", "Seasons"])
			expect(isSeasonOnlyTitle(title)).toBe(false)
	})
})

describe("CheckedCards", () => {
	it("skips an unrated card until its title changes", () => {
		const checked = new CheckedCards()
		const card = document.createElement("article")
		expect(checked.isChecked(card, "Unrated Show")).toBe(false)
		checked.mark(card, "Unrated Show")
		expect(checked.isChecked(card, "Unrated Show")).toBe(true)
		// Prime reused the card for another title
		expect(checked.isChecked(card, "Another Show")).toBe(false)
	})

	it("checks again once a timed mark runs out", () => {
		const checked = new CheckedCards()
		const card = document.createElement("article")
		checked.mark(card, "Not Found", 1000)
		expect(checked.isChecked(card, "Not Found", 999)).toBe(true)
		expect(checked.isChecked(card, "Not Found", 1000)).toBe(false)
	})
})

describe("friends lookup recovery", () => {
	it("keeps the public score temporary when friends failed, then accepts a recovered score", async () => {
		settings.value.General.ratingSources = "both"
		let unavailable = true
		vi.mocked(sendMessage).mockImplementation((async (name: string) => {
			if (name === "fetch")
				return {
					results: [{ id: 123, title: "Recovery Example", media_type: "movie", vote_average: 8, vote_count: 900 }],
				}
			if (name === "letterboxdRating")
				return {
					source: "letterboxd",
					rating: 4,
					rating_count: 10,
					url: "https://letterboxd.com/film/example/",
					friends_unavailable: unavailable || undefined,
					friends_count: unavailable ? undefined : 2,
					friends_rating: unavailable ? undefined : 4.5,
				}
			return null
		}) as never)
		const failed = await lookupMovieInfo("Recovery Example", "movie", null)
		expect(failed?.rating).toBe(4)
		expect(isCacheCurrent(failed!)).toBe(false)
		expect(failed).toMatchObject({ retryAfter: expect.any(Number) })
		unavailable = false
		const recovered = await lookupMovieInfo("Recovery Example", "movie", null)
		expect(recovered?.friends_rating).toBe(4.5)
		expect(isCacheCurrent(recovered!)).toBe(true)
	})
})

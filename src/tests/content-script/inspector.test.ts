import { describe, expect, it } from "vitest"
import type { MovieInfo } from "../../content-script/cache"
import { parseProviders, renderInspector, type Availability } from "../../content-script/inspector"

const FILM: MovieInfo = {
	id: 693134,
	title: "Dune: Part Two",
	media_type: "movie",
	score: 8.1,
	vote_count: 1200,
	release_date: "2024-02-27",
	poster_path: null,
	date: "2026-10-22",
	db: "tmdb",
	source: "letterboxd",
	rating: 4.2,
	rating_count: 1_200_000,
	rating_url: "https://letterboxd.com/film/dune-part-two/",
	friends_rating: 4.5,
	friends_count: 7,
	friends: [
		{ name: "Maya", rating: 5 },
		{ name: "Tom", rating: 4.5 },
	],
}

const AVAILABILITY: Availability = {
	rows: [
		{ name: "Netflix", kind: "flatrate" },
		{ name: "Amazon Prime Video", kind: "flatrate" },
		{ name: "Apple TV", kind: "rent" },
	],
	link: "https://www.themoviedb.org/movie/693134/watch",
}

describe("watch providers", () => {
	it("dedupes a provider to its best offer and keeps TMDb's link", () => {
		expect(
			parseProviders(
				{
					results: {
						GB: {
							link: "https://www.themoviedb.org/movie/1/watch",
							flatrate: [{ provider_name: "Netflix" }, { provider_name: "Amazon Prime Video" }],
							rent: [{ provider_name: "Apple TV" }, { provider_name: "Amazon Prime Video" }],
							buy: [{ provider_name: "Apple TV" }],
						},
					},
				},
				"GB",
			),
		).toEqual({
			rows: [
				{ name: "Amazon Prime Video", kind: "flatrate" },
				{ name: "Netflix", kind: "flatrate" },
				{ name: "Apple TV", kind: "rent" },
			],
			link: "https://www.themoviedb.org/movie/1/watch",
		})
	})
	it("separates a missing region from an unreachable request", () => {
		expect(parseProviders({ results: {} }, "GB")).toEqual({ rows: [] })
		expect(parseProviders({ error: "HTTP 429" }, "GB")).toBeNull()
	})
})

describe("card inspector", () => {
	it("shows the score, friends, personal status and availability", () => {
		const content = renderInspector(FILM, { watchlist: true }, "Netflix", true, AVAILABILITY)
		expect(content.textContent).toContain("Dune: Part Two")
		expect(content.textContent).toContain("Letterboxd average")
		expect(content.textContent).toContain("4.2 / 5")
		expect(content.textContent).toContain("1.2M ratings")
		expect(content.textContent).toContain("Maya")
		expect(content.textContent).toContain("Watching here")
		expect(content.textContent).toContain("Amazon Prime Video")
		expect(content.textContent).toContain("Included")
		expect(content.textContent).toContain("Apple TV")
		expect(content.textContent).toContain("Rent")
		expect(content.textContent).toContain("Availability by JustWatch")
		expect(content.querySelectorAll(".provider")).toHaveLength(3)
		expect(content.querySelector<HTMLAnchorElement>("a.btn")!.getAttribute("href")).toBe(
			"https://letterboxd.com/film/dune-part-two/",
		)
	})
	it("tells loading apart from a failed availability lookup", () => {
		expect(renderInspector(FILM, { watchlist: false }, "Netflix", true, undefined).textContent).toContain(
			"Checking availability",
		)
		expect(renderInspector(FILM, { watchlist: false }, "Netflix", true, null).textContent).toContain(
			"Availability unavailable",
		)
	})
})

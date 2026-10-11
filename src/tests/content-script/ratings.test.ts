import { afterEach, describe, expect, it, vi } from "vitest"
import {
	fetchImdbRating,
	fetchLetterboxdRating,
	getLetterboxdSlug,
	getScoreColor,
	guessLetterboxdSlug,
	parseLetterboxdTmdbId,
	parseFriendRatings,
	parseFriendRows,
	parseLetterboxdHtml,
	parseProfileGrid,
	SCORE_COLORS,
	TransientLookupError,
} from "../../utils/ratings"

const wrap = (json: string) => `<html><head><script type="application/ld+json">
/* <![CDATA[ */
${json}
/* ]]> */
</script></head></html>`

describe("parseLetterboxdHtml", () => {
	it("parses the CDATA-wrapped aggregate rating", () => {
		const html = wrap(
			'{"@type":"Movie","name":"Fight Club","aggregateRating":{"@type":"aggregateRating","bestRating":5,"ratingValue":4.27,"ratingCount":6170786,"worstRating":0.5}}',
		)
		expect(parseLetterboxdHtml(html)).toEqual({ rating: 4.27, rating_count: 6170786 })
	})

	it("parses JSON-LD without the CDATA wrapper", () => {
		const html = '<script type="application/ld+json">{"aggregateRating":{"ratingValue":3.5,"ratingCount":10}}</script>'
		expect(parseLetterboxdHtml(html)).toEqual({ rating: 3.5, rating_count: 10 })
	})

	it("returns null for a film with no ratings yet", () => {
		expect(parseLetterboxdHtml(wrap('{"@type":"Movie","name":"Unreleased"}'))).toBeNull()
	})

	it("returns null when there is no JSON-LD", () => {
		expect(parseLetterboxdHtml("<html></html>")).toBeNull()
	})

	it("returns null for malformed JSON", () => {
		expect(parseLetterboxdHtml(wrap("{not json"))).toBeNull()
	})
})

const friendRow = (name: string, rating: string) =>
	`<tr> <td class="col-member table-person"><div class="person-summary"> <h3 class="title-3"> <a href="/${name.toLowerCase()}/" class="name"> ${name} </a> </h3> </div></td> <td class="col-rating -padding-inline-large"> <span class="rating -green ${rating}"> ★★★★ </span> </td> </tr>`

describe("parseFriendRows", () => {
	it("reads names and half-star ratings, skipping friends who watched without rating", () => {
		const html = `<table>${friendRow("Sam", "rated-8")}${friendRow("Alex", "")}${friendRow("Jo &amp; Co", "rated-9")}${friendRow("Kim", "rated-1")}</table>`
		expect(parseFriendRows(html)).toEqual([
			{ name: "Sam", rating: 4 },
			{ name: "Jo & Co", rating: 4.5 },
			{ name: "Kim", rating: 0.5 },
		])
		expect(parseFriendRatings(html)).toEqual([4, 4.5, 0.5])
	})

	it("returns an empty list when no friend has watched it", () => {
		expect(parseFriendRows("<table></table>")).toEqual([])
	})
})

describe("parseProfileGrid", () => {
	const item = (slug: string, rating = "") =>
		`<li class="griditem"> <div class="react-component" data-item-slug="${slug}" data-item-link="/film/${slug}/"></div> <p class="poster-viewingdata">${rating ? `<span class="rating -micro -darker ${rating}">★★★★</span>` : ""}</p> </li>`

	it("maps each logged film to the user's rating (0 when unrated)", () => {
		const html = `<ul>${item("dune-part-three", "rated-10")}${item("tony-2026", "rated-7")}${item("the-celebration")}</ul><div class="sidebar"><span class="rated-2"></span></div>`
		expect(parseProfileGrid(html)).toEqual([
			{ slug: "dune-part-three", rating: 5 },
			{ slug: "tony-2026", rating: 3.5 },
			{ slug: "the-celebration", rating: 0 },
		])
	})
})

describe("getLetterboxdSlug", () => {
	it("pulls the slug out of a film URL", () => {
		expect(getLetterboxdSlug("https://letterboxd.com/film/the-gray-man-2022/")).toBe("the-gray-man-2022")
		expect(getLetterboxdSlug("https://www.imdb.com/title/tt0903747/")).toBeUndefined()
		expect(getLetterboxdSlug(undefined)).toBeUndefined()
	})
})

describe("temporary failures", () => {
	const realFetch = globalThis.fetch
	afterEach(() => {
		globalThis.fetch = realFetch
	})
	const respond = (status: number, url = "https://letterboxd.com/tmdb/1/") =>
		(globalThis.fetch = vi.fn(async () => ({ ok: status < 400, status, url, text: async () => "" }) as unknown as Response))

	it("throws on rate limits and challenges so callers don't cache them", async () => {
		respond(429)
		await expect(fetchLetterboxdRating(550)).rejects.toBeInstanceOf(TransientLookupError)
		respond(403)
		await expect(fetchImdbRating("tt0903747")).rejects.toBeInstanceOf(TransientLookupError)
	})

	it("treats a 404 as no rating", async () => {
		respond(404)
		await expect(fetchLetterboxdRating(550)).resolves.toBeNull()
	})
})

describe("getScoreColor", () => {
	const [red, orange, yellow, lightGreen, green] = SCORE_COLORS

	it("bands Letterboxd ratings on the /5 scale", () => {
		expect(getScoreColor("letterboxd", 1.2)).toBe(red)
		expect(getScoreColor("letterboxd", 2.5)).toBe(orange)
		expect(getScoreColor("letterboxd", 3.32)).toBe(yellow)
		expect(getScoreColor("letterboxd", 3.99)).toBe(lightGreen)
		expect(getScoreColor("letterboxd", 4.6)).toBe(green)
	})

	it("bands IMDb ratings higher, since TV skews towards 8", () => {
		expect(getScoreColor("imdb", 6.5)).toBe(red)
		expect(getScoreColor("imdb", 7.5)).toBe(orange)
		expect(getScoreColor("imdb", 8)).toBe(yellow)
		expect(getScoreColor("imdb", 8.4)).toBe(lightGreen)
		expect(getScoreColor("imdb", 9.5)).toBe(green)
	})
})

describe("guessLetterboxdSlug", () => {
	it("matches Letterboxd's slugs for plain titles", () => {
		expect(guessLetterboxdSlug("Fight Club")).toBe("fight-club")
		expect(guessLetterboxdSlug("Ocean's Eleven")).toBe("oceans-eleven")
		expect(guessLetterboxdSlug("Willy Wonka & the Chocolate Factory")).toBe("willy-wonka-the-chocolate-factory")
		expect(guessLetterboxdSlug("Amélie")).toBe("amelie")
		expect(guessLetterboxdSlug("Mission: Impossible II")).toBe("mission-impossible-ii")
	})
})

describe("parseLetterboxdTmdbId", () => {
	it("reads which TMDb film a page is", () => {
		expect(parseLetterboxdTmdbId('<body class="film" data-tmdb-id="550" data-tmdb-type="movie">')).toEqual({
			id: 550,
			type: "movie",
		})
		expect(parseLetterboxdTmdbId("<body>")).toBeNull()
	})
})

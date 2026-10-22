import { afterEach, describe, expect, it } from "vitest"
import { renderBadge } from "../../content-script/badge"
import type { MovieInfo } from "../../content-script/cache"
import { defaultSettings, type settingsType } from "../../stores/storeTypes"
import { classicLook } from "../../utils/page-feature-styles"

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

function badge(overrides: Partial<settingsType["General"]> = {}) {
	const general = { ...defaultSettings.General, ...overrides }
	return renderBadge(FILM, {
		general,
		look: classicLook,
		personal: { watchlist: true },
		position: { corner: "top", zIndex: "2" },
		cardTitle: "Dune: Part Two",
	})
}

afterEach(() => {
	document.body.innerHTML = ""
})

describe("badge detail", () => {
	it("shows the score, friends and your status by default", () => {
		const full = badge()
		expect(full.textContent).toContain("4.2")
		expect(full.textContent).toContain("friends")
		expect(full.textContent).toContain("4.5")
		expect(full.textContent).toContain("watchlist")
	})
	it("keeps only the score in the sticker, but the tooltip keeps the rest", () => {
		const compact = badge({ badgeDetail: "score" })
		expect(compact.textContent).toBe("4.2")
		expect(compact.title).toContain("Letterboxd 4.20/5")
		expect(compact.title).toContain("Friends 4.5 from 7")
		expect(compact.title).toContain("On your watchlist")
	})
})

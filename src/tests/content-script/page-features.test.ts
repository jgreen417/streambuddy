import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	readDetailContext,
	readEpisodeCards,
	EpisodeRatings,
	SearchRatingSort,
	type FeatureRating,
} from "../../utils/page-features"
import { badgeLook } from "../../utils/page-feature-styles"

describe("page adapters", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
		document.title = ""
	})
	it("reads Netflix title metadata and the selected season without using episode titles", () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Stranger Things</h3></div><div data-uia="previewModal--detailsMetadata"><span class="year">2016</span><span class="duration">5 seasons</span></div><button data-uia="dropdown-toggle">Stranger Things 5</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">2</span></div></div></div>`
		const context = readDetailContext("netflix")!
		expect(context.title).toBe("Stranger Things")
		expect(context.mediaType).toBe("tv")
		expect(context.year).toBe("2016")
		expect(readEpisodeCards("netflix", context.root).map((e) => [e.season, e.episode])).toEqual([[5, 2]])
	})
	it("maps HBO episodes by their explicit season and episode label", () => {
		document.title = "The Last of Us • HBO Max"
		document.body.innerHTML = `<div data-testid="details-hero-container"><button data-testid="play_button" aria-label="Watch The Last of Us"></button></div><section data-testid="generic-show-page-rail-episodes-tabbed-content_rail"><a href="/video/watch/one" aria-label="Watch Season 2, Episode 1: Future Days."><div data-testid="episode_tileImage"></div></a></section>`
		const context = readDetailContext("hbo", "/show/series")!
		expect(context.title).toBe("The Last of Us")
		expect(readEpisodeCards("hbo", document.body)[0]).toMatchObject({ season: 2, episode: 1 })
	})
	it("reads Prime title, insertion point and season from the detail page", () => {
		document.title = "Prime Video: Fallout - Season 2"
		document.body.innerHTML = `<div data-testid="atf-component-next-gen"><h1>Fallout</h1><span data-testid="release-year-badge">2024</span><p data-testid="dp-atf-synopsis">Synopsis</p></div><div data-testid="episode-list-item" title="3. Episode 3: The Head"><div data-testid="episode-packshot"></div></div>`
		const context = readDetailContext("prime")!
		expect(context.title).toBe("Fallout")
		expect(context.before?.dataset.testid).toBe("dp-atf-synopsis")
		expect(readEpisodeCards("prime", document.body)[0]).toMatchObject({ season: 2, episode: 3 })
	})
	it("reads the season from a Prime page in another language", () => {
		document.title = "Amazon.fr : Fallout - Saison 2 | Prime Video"
		document.body.innerHTML = `<div data-testid="atf-component-next-gen"><h1>Fallout</h1></div><div data-testid="episode-list-item" title="Épisode 3 : La Tête"><div data-testid="episode-packshot"></div></div>`
		expect(readDetailContext("prime")?.mediaType).toBe("tv")
		expect(readEpisodeCards("prime", document.body)[0]).toMatchObject({ season: 2, episode: 3 })
	})
	it("reads the season from a Prime page in Hindi", () => {
		document.title = "Amazon.in: फ़ॉलआउट - सीज़न 2 | Prime Video"
		document.body.innerHTML = `<div data-testid="atf-component-next-gen"><h1>फ़ॉलआउट</h1></div><div data-testid="episode-list-item" title="एपिसोड 3"><div data-testid="episode-packshot"></div></div>`
		expect(readEpisodeCards("prime", document.body)[0]).toMatchObject({ season: 2, episode: 3 })
	})
	it("maps Crunchyroll episodes by the season picker and the E-number in each title", () => {
		document.body.innerHTML = `<h1 class="hero-body__seo-title--x1">Frieren: Beyond Journey's End</h1><div class="erc-seasons-select"><div role="button" aria-label="Staffeln"><span>Staffel 2</span></div></div><div class="erc-playable-collection"><div data-t="episode-card "><a href="/watch/G7PU4MZ1G"><figure></figure></a><h3><a>E3 - Killing Magic</a></h3></div></div>`
		const context = readDetailContext("crunchyroll")!
		expect(context.title).toBe("Frieren: Beyond Journey's End")
		expect(context.mediaType).toBe("tv")
		expect(readEpisodeCards("crunchyroll", context.root)[0]).toMatchObject({ season: 2, episode: 3 })
	})
	it("finds the Netflix title when the About heading sits outside the about container", () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><h3>About The Irishman</h3><div data-uia="about-container"><div>Cast</div></div><div data-uia="previewModal--detailsMetadata"><span class="year">2019</span></div></div>`
		expect(readDetailContext("netflix")?.title).toBe("The Irishman")
	})
	it("reads the Prime title from title art when the heading has no text", () => {
		document.body.innerHTML = `<div data-testid="atf-component-next-gen"><h1><img alt="The Boys" src="x.png"></h1></div>`
		expect(readDetailContext("prime")?.title).toBe("The Boys")
	})
	it("strips direction marks around the HBO play button label", () => {
		document.body.innerHTML = `<div data-testid="details-hero-container"><button data-testid="play_button" aria-label="\u2068Watch Dune: Part Two\u2069"></button></div>`
		expect(readDetailContext("hbo", "/movie/dune")?.title).toBe("Dune: Part Two")
	})
	it("reads the HBO film title once it has been watched", () => {
		document.body.innerHTML = `<div data-testid="details-hero-container"><button data-testid="play_button" aria-label="\u2066\u2068Watch again: Freddy vs. Jason\u2069\u2069"></button></div>`
		expect(readDetailContext("hbo", "/movie/freddy")?.title).toBe("Freddy vs. Jason")
	})
})

describe("episode ratings", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
	})
	it("never adds a rating panel to a title page", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Film</h3></div><div data-uia="previewModal--detailsMetadata"><span class="year">2019</span></div></div>`
		const lookup = vi.fn(async () => ({
			id: 1,
			title: "Film",
			media_type: "movie",
			source: "letterboxd" as const,
			rating: 4,
		}))
		const features = new EpisodeRatings(lookup, async () => [])
		await features.tick("netflix", { episodes: true })
		expect(document.querySelector(".sb-detail-panel")).toBeNull()
		expect(document.body.textContent).not.toContain("Letterboxd")
	})
	it("does not render an old title's episodes after navigation", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Old</h3></div><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><button data-uia="dropdown-toggle">Season 1</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">1</span></div></div></div>`
		let resolve!: (value: FeatureRating) => void
		const features = new EpisodeRatings(
			() =>
				new Promise((r) => {
					resolve = r
				}),
			async () => [{ id: "tt1", season: 1, episode: 1, title: "Pilot", rating: 8, votes: 100 }],
		)
		const pending = features.tick("netflix", { episodes: true })
		document.querySelector("h3")!.textContent = "About New"
		resolve({ id: 1, title: "Old", media_type: "tv", source: "imdb", rating: 8 })
		await pending
		expect(document.querySelector(".sb-episode-rating")).toBeNull()
	})
	it("removes the previous season's chip before the new season lookup fails", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Show</h3></div><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><button data-uia="dropdown-toggle">Season 1</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">1</span></div></div></div>`
		const features = new EpisodeRatings(
			async () => ({ id: 1, title: "Show", media_type: "tv", source: "imdb", rating: 8 }),
			async (data, season) => {
				if (season === 2) throw new Error("Unavailable")
				return [{ id: "tt1", season: 1, episode: 1, title: "Pilot", rating: 8, votes: 100 }]
			},
		)
		await features.tick("netflix", { episodes: true })
		expect(document.querySelector(".sb-episode-rating")).not.toBeNull()
		document.querySelector('[data-uia="dropdown-toggle"]')!.textContent = "Season 2"
		await features.tick("netflix", { episodes: true })
		expect(document.querySelector(".sb-episode-rating")).toBeNull()
	})
	it("removes episode chips when the setting is turned off", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Show</h3></div><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><button data-uia="dropdown-toggle">Season 1</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">1</span></div></div></div>`
		const features = new EpisodeRatings(
			async () => ({ id: 1, title: "Show", media_type: "tv", source: "imdb", rating: 8 }),
			async () => [{ id: "tt1", season: 1, episode: 1, title: "Pilot", rating: 8, votes: 100 }],
		)
		await features.tick("netflix", { episodes: true })
		expect(document.querySelectorAll(".sb-episode-rating")).toHaveLength(1)
		await features.tick("netflix", { episodes: false })
		expect(document.querySelector(".sb-episode-rating")).toBeNull()
	})
	it("marks the unique best-rated episode of a season", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Show</h3></div><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><button data-uia="dropdown-toggle">Season 1</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">1</span></div><div data-uia="titleCard--container"><span class="titleCard-title_index">2</span></div><div data-uia="titleCard--container"><span class="titleCard-title_index">3</span></div></div></div>`
		const features = new EpisodeRatings(
			async () => ({ id: 1, title: "Show", media_type: "tv", source: "imdb", rating: 8 }),
			async () => [
				{ id: "tt1", season: 1, episode: 1, title: "One", rating: 8.1, votes: 100 },
				{ id: "tt2", season: 1, episode: 2, title: "Two", rating: 9.2, votes: 100 },
				{ id: "tt3", season: 1, episode: 3, title: "Three", rating: 8.4, votes: 100 },
			],
		)
		await features.tick("netflix", { episodes: true })
		const best = document.querySelectorAll<HTMLElement>('.sb-episode-rating[data-best="true"]')
		expect(best).toHaveLength(1)
		expect(best[0].querySelector(".sb-episode-best")?.textContent).toBe("★")
		expect(best[0].querySelector(".sb-episode-score")?.textContent).toBe("9.2")
		expect(best[0].title).toContain("Best rated episode of the season")
	})
	it("does not mark a tie", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Show</h3></div><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><button data-uia="dropdown-toggle">Season 1</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">1</span></div><div data-uia="titleCard--container"><span class="titleCard-title_index">2</span></div></div></div>`
		const features = new EpisodeRatings(
			async () => ({ id: 1, title: "Show", media_type: "tv", source: "imdb", rating: 8 }),
			async () => [
				{ id: "tt1", season: 1, episode: 1, title: "One", rating: 8.4, votes: 100 },
				{ id: "tt2", season: 1, episode: 2, title: "Two", rating: 8.4, votes: 100 },
			],
		)
		await features.tick("netflix", { episodes: true })
		expect(document.querySelector('.sb-episode-rating[data-best="true"]')).toBeNull()
	})
	it("draws episode chips like the card badge, in glass when badges are", async () => {
		document.body.innerHTML = `<div data-uia="modal-motion-container-DETAIL_MODAL"><div data-uia="about-container"><h3>About Show</h3></div><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><button data-uia="dropdown-toggle">Season 1</button><div data-uia="episode-selector"><div data-uia="titleCard--container"><span class="titleCard-title_index">1</span></div></div></div>`
		const features = new EpisodeRatings(
			async () => ({ id: 1, title: "Show", media_type: "tv", source: "imdb", rating: 8 }),
			async () => [{ id: "tt1", season: 1, episode: 1, title: "Pilot", rating: 8.1, votes: 100 }],
		)
		await features.tick("netflix", { episodes: true })
		let chip = document.querySelector<HTMLElement>(".sb-episode-rating")!
		expect(chip.querySelector(".sb-episode-score")?.textContent).toBe("8.1")
		expect(chip.querySelector(".sb-episode-source")?.textContent).toBe("IMDb")
		expect(chip.style.backdropFilter).toBe("")
		await features.tick("netflix", { episodes: true, look: badgeLook({ badgeStyle: "glass", glassFrost: 60 }) })
		chip = document.querySelector<HTMLElement>(".sb-episode-rating")!
		expect(chip.style.backdropFilter).toContain("blur")
		expect(chip.style.getPropertyValue("--sb-badge-label")).not.toBe("")
	})
})

describe("search sorting", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
	})
	it("sorts by rating without moving framework-owned DOM nodes and restores site order", () => {
		document.body.innerHTML = `<section data-uia="gallery"><div id="a"></div><div id="b"></div><div id="c"></div></section>`
		const grid = document.querySelector<HTMLElement>("section")!
		const [a, b, c] = Array.from(grid.children) as HTMLElement[]
		b.style.order = "3"
		const sorting = new SearchRatingSort()
		sorting.setRating(a, 7)
		sorting.setRating(b, 9)
		sorting.update(grid)
		const button = document.querySelector<HTMLButtonElement>(".sb-search-sort")!
		button.click()
		expect([a.style.order, b.style.order, c.style.order]).toEqual(["1", "0", "2"])
		expect(Array.from(grid.children)).toEqual([a, b, c])
		button.click()
		expect([a.style.order, b.style.order, c.style.order]).toEqual(["", "3", ""])
	})
})

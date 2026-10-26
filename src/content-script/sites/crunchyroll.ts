import { crunchyroll, crunchyrollPath, playingSkipEvents } from "@/playback/sites/crunchyroll"
import { gridsAround } from "./dom"
import type { MediaType, RatingsSite } from "./types"

// Crunchyroll's class names are hashed per build, so cards are found by their data-t (some of which end in a space)
const BROWSE = '[data-t^="series-card"]:not(.imdb)'
const NEW_EPISODE = '[data-t="release-episode-card"]:not(.imdb)'
const SEARCH_KINDS = ["series", "movie", "episode"].map((kind) => `[data-t="search-${kind}-card"]`)
// every search card, rated or not, so the sortable grids are still found once their cards are rated
const SEARCH_CARD = SEARCH_KINDS.join(", ")
const SEARCH = SEARCH_KINDS.map((card) => `${card}:not(.imdb)`).join(", ")

// "From Far Away Season 1" -> "From Far Away": the New Episodes row names the season after the series
export const withoutSeason = (title: string | null | undefined) =>
	title?.replace(/\s+(?:Season|Staffel|Saison|Temporada|Stagione|Sezon|Säsong|Sezonul)\s+\d+$/iu, "").trim() ||
	undefined

const textOf = (card: HTMLElement, selector: string) => card.querySelector(selector)?.textContent?.trim() || undefined

// A film is a one-season, one-episode series here, and so is a one-off special, so a browse card only says "tv" when
// its hover card counts more than one episode ("2 Seasons 38 Episodes", in the profile's language); the films list
// says "movie" outright
function browseMediaType(card: HTMLElement, url: string): MediaType {
	if (/[?&]media=movies\b/.test(url)) return "movie"
	const episodes = Number(/^\D*\d+\D+(\d+)/.exec(textOf(card, '[data-t="meta-info"]') ?? "")?.[1])
	return episodes > 1 ? "tv" : null
}

export const crunchyrollSite: RatingsSite = {
	service: "Crunchyroll",
	// Crunchyroll's content tags sit along the poster's top-left
	badge: { corner: "top", zIndex: "2" },
	titleCards: () => [
		document.querySelectorAll(BROWSE),
		document.querySelectorAll(NEW_EPISODE),
		document.querySelectorAll(SEARCH),
	],
	seenMarker: (card) => card,
	// told apart by the card itself: the shared code asks again without saying which kind of card it is
	cleanTitle(card) {
		if (card.dataset.t === "release-episode-card") return withoutSeason(textOf(card, "h4 a"))
		if (card.dataset.t === "search-episode-card") return textOf(card, 'small[data-t="series-title"]')
		if (card.dataset.t?.startsWith("search-")) return textOf(card, "h2")
		return (
			textOf(card, 'h3[data-t="title"]') ??
			card.querySelector('img[data-t="original-image"]')?.getAttribute("alt") ??
			undefined
		)
	},
	mediaType(card, url) {
		if (card.dataset.t === "search-movie-card") return "movie"
		if (card.dataset.t?.startsWith("search-") || card.dataset.t === "release-episode-card") return "tv"
		return browseMediaType(card, url)
	},
	// the link that holds the artwork: the poster on browse and search cards, the thumbnail on episode cards
	badgeHost(card) {
		const host = card.querySelector<HTMLElement>('a:has([class*="content-image--"])')
		if (!host) return null
		if (getComputedStyle(host).position === "static") host.style.position = "relative"
		return { host, corner: "top" }
	},
	rowItem: (card) => card.closest<HTMLElement>('[data-t="carousel-card-wrapper"]') ?? card,
	searchGrids: () => (crunchyrollPath().startsWith("/search") ? gridsAround(SEARCH_CARD, SEARCH_CARD) : []),
	isPlayerPage: () => crunchyrollPath().startsWith("/watch/"),
	// where Crunchyroll's own skip times put the credits
	creditsFromEnd(video) {
		const credits = playingSkipEvents()?.credits
		return credits && Number.isFinite(video.duration) ? video.duration - credits.start : undefined
	},
	playingTitle: () => crunchyroll.showTitle(),
	// a film's player page names no episode number
	playingEpisode() {
		const episode = crunchyroll.episodeNumber()
		if (episode === null) return undefined
		const season = crunchyroll.episodeSeason?.()
		const show = crunchyroll.showTitle()
		return season && show ? { show, season, episode } : null
	},
	endScreenShowing: () => false,
	// the player sits at the top of a scrolling page, not filling the window, so the pill goes in its top right corner
	placeReview(review) {
		const player = crunchyroll.playerRoot()?.getBoundingClientRect()
		if (!player?.width) return
		review.classList.add("sb-review-top")
		const right = document.documentElement.clientWidth - player.right
		review.style.setProperty("--sb-review-top", `${Math.round(Math.max(0, player.top) + 16)}px`)
		review.style.setProperty("--sb-review-right", `${Math.round(Math.max(0, right) + 16)}px`)
	},
}

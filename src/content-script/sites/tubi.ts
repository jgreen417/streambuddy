import { playingTubiTitle, tubi } from "@/playback/sites/tubi"
import { gridsAround } from "./dom"
import type { MediaType, RatingsSite } from "./types"

// One poster tile everywhere (home rows, browse grids, search), and the wide "You May Also Like" cards on title and
// player pages, whose class names are hashed: those are known by a link to a film or series holding a heading
const TILE = ".web-content-tile"
const WIDE = ':is(a[href^="/movies/"], a[href^="/series/"]):has(h3):has(img)'

const isTile = (card: HTMLElement) => card.matches(TILE)
const link = (card: HTMLElement) =>
	isTile(card) ? card.querySelector("a.web-content-tile__poster-link")?.getAttribute("href") : card.getAttribute("href")

export const tubiSite: RatingsSite = {
	service: "Tubi",
	// Tubi's "Only on Tubi" and "New Episode" labels sit along the poster's top-left
	badge: { corner: "top", zIndex: "2" },
	titleCards: () => [
		document.querySelectorAll(`${TILE}:not(.sb-seen)`),
		document.querySelectorAll(`${WIDE}:not(.sb-seen)`),
	],
	seenMarker: (card) => card,
	cleanTitle(card) {
		if (!isTile(card)) return card.querySelector("h3")?.textContent?.trim() || undefined
		return (
			card.querySelector("a.web-content-tile__title")?.textContent?.trim() ||
			card.querySelector("img.web-poster__image-element")?.getAttribute("alt") ||
			undefined
		)
	},
	mediaType(card): MediaType {
		const href = link(card) ?? ""
		if (href.startsWith("/movies/")) return "movie"
		return href.startsWith("/series/") ? "tv" : null
	},
	// the poster link on a tile, the 16:9 thumbnail's box on a wide card
	badgeHost(card) {
		const host = isTile(card)
			? card.querySelector<HTMLElement>("a.web-content-tile__poster-link")
			: card.querySelector("img")?.parentElement
		if (!host) return null
		if (getComputedStyle(host).position === "static") host.style.position = "relative"
		return { host, corner: "top" }
	},
	rowItem: (card) => card.closest<HTMLElement>('[data-test-id="web-ui-grid-item"]') ?? card,
	searchGrids: () => (location.pathname.startsWith("/search") ? gridsAround(TILE, TILE) : []),
	isPlayerPage: () => tubi.video() !== null,
	playerClock: () => tubi.video(),
	// where Tubi's page data puts the credits
	creditsFromEnd(video) {
		const postlude = playingTubiTitle()?.postlude
		return postlude && Number.isFinite(video.duration) ? video.duration - postlude : undefined
	},
	playingTitle: () => tubi.showTitle(),
	// an episode's page whose label can't be read is still an episode, not a film
	playingEpisode() {
		const episode = tubi.episodeNumber()
		if (episode === null) return location.pathname.startsWith("/tv-shows/") ? null : undefined
		const season = tubi.episodeSeason?.()
		const show = tubi.showTitle()
		return season && show ? { show, season, episode } : null
	},
	// the next-up panel slides up over the player at the start of the credits and counts down to the next title
	endScreenShowing() {
		const next = document.querySelector('a[data-test-id="atag-link"][href*="autoplay=true"]')?.getBoundingClientRect()
		return !!next?.width && next.top < innerHeight
	},
	// the next-up panel covers the bottom of the player and the sign-up button its bottom left, so the pill opens
	// downwards from the video's top left
	placeReview(review) {
		const player = tubi.video()?.getBoundingClientRect()
		if (!player?.width) return
		review.classList.add("sb-review-top", "sb-review-left")
		review.style.setProperty("--sb-review-top", `${Math.round(Math.max(0, player.top) + 16)}px`)
		review.style.setProperty("--sb-review-left", `${Math.round(Math.max(0, player.left) + 16)}px`)
	},
}

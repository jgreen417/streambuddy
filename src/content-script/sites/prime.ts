import { episodeInfo, prime } from "@/playback/sites/prime"
import { isSeasonOnlyTitle } from "@/utils/tmdb"
import { raiseBadges } from "@/content-script/badge"
import { markedCreditsFromEnd } from "../credits-marker"
import { episodeFromPlayer, gridsAround } from "./dom"
import type { MediaType, RatingsSite } from "./types"

// The card's own link to its title page. Not simply its first link: the badge is a link too, and once Prime re-renders a
// card (the large cards do on hover) the badge can come first, which read as the card having no title and dropped it.
export function titleLink(card: HTMLElement) {
	const link = card.querySelector<HTMLAnchorElement>("a:not(.sb-card-rating)")
	return link?.href?.includes("detail") ? link : undefined
}
function fixTitle(title: string | undefined) {
	return title
		?.split(" - ")[0]
		.split(" – ")[0]
		.replaceAll(/(S\d+)/g, "")
		.replaceAll(/ \[.*\]/g, "")
		.replaceAll(/\s\(.*\)/g, "")
		.replaceAll(/:?\sStaffel-?\s\d+/g, "")
		.replaceAll(/:?\sSeason-?\s\d+/g, "")
		.replaceAll(/ \/ \d/g, "")
		.split(": Die komplette")[0]
		.split(": The complete")[0]
}
function entityMediaType(type: string): MediaType {
	if (!type) return null
	if (type.toLowerCase().includes("tv")) return "tv"
	if (type.toLowerCase().includes("movie")) return "movie"
	return null
}

// Prime composites its own "prime" or channel logo into the artwork's bottom-right corner, and the image URL
// says where: _CLs|W,H|...channels-logo...|...+x,y,w,h. Returns how far up the card the logo reaches (0 when none).
// Read it off the image on show: the large cards also hold a hidden landscape image with its logo elsewhere.
function logoHeight(container: HTMLElement) {
	const area = (el: Element) => el.getBoundingClientRect().width * el.getBoundingClientRect().height
	const img = Array.from(container.querySelectorAll("img")).reduce<HTMLImageElement | null>(
		(best, el) => (!best || area(el) > area(best) ? el : best),
		null,
	)
	if (!img) return 0
	const src = decodeURIComponent(img.currentSrc || img.src || img.srcset)
	const match = /_CLs\|\d+,(\d+)\|[^|]*channels-logo[^|]*\|(?:\d+,\d+,\d+,\d+\+)*\d+,(\d+),\d+,\d+/.exec(src)
	if (!match) return 0
	const height = Number(match[1])
	return (height - Number(match[2])) / height
}
// The badges in a carousel row share one line, clear of the tallest logo among the row's cards. Prime adds cards as
// the row scrolls, so the height is worked out again when the row grows, and a taller logo lifts the badges already drawn.
const rowLogos = new WeakMap<Element, { cards: number; height: number }>()
function rowLogoHeight(card: HTMLElement, host: HTMLElement) {
	const row = card.closest("li")?.parentElement
	if (!row) return logoHeight(host)
	const known = rowLogos.get(row)
	if (known?.cards === row.children.length && logoHeight(host) <= known.height) return known.height
	const height = Math.max(...Array.from(row.querySelectorAll<HTMLElement>(":scope > li"), logoHeight))
	rowLogos.set(row, { cards: row.children.length, height })
	if (known && height > known.height) raiseBadges(row, height)
	return height
}

// kind 0: cards in rows (and the search grid's own listitems), which carry their title; kind 1: the other cards
export const primeSite: RatingsSite = {
	service: "Amazon",
	badge: { corner: "bottom", zIndex: "3" },
	titleCards: () => [
		document.querySelectorAll(
			// rows hold their cards in li; the search grid's cards are listitems themselves (article[data-testid=card])
			":is(li article, article[data-testid='card'])[data-card-title]:not([data-card-entity-type='EVENT']):not([data-card-title='Live-TV']):not(:has(.sb-card-rating))",
		),
		document.querySelectorAll("article[data-testid*='-card']:not(:has(.sb-card-rating))"),
	],
	seenMarker: (card, kind) => (kind === 0 ? card.closest("li") : card),
	cleanTitle(card, kind) {
		// detail means not live shows
		const link = titleLink(card)
		if (!link) return undefined
		const title = kind === 0 ? fixTitle(card.dataset.cardTitle ?? "") : fixTitle(link.getAttribute("aria-label") ?? "")
		return title && isSeasonOnlyTitle(title) ? undefined : title
	},
	mediaType(card, url) {
		if (url.includes("video/tv")) return "tv"
		if (url.includes("video/movie")) return "movie"
		return entityMediaType(card.dataset.cardEntityType ?? "")
	},
	// detail pages also list extras and trailers; only rate the "related" tab there
	ratesCards: () =>
		!location.href.includes("detail") ||
		document.querySelector('[data-testid="btf-related-tab"]')?.getAttribute("tabIndex") == "0",
	badgeHost(card) {
		if (card.dataset.cardTitle) {
			const host = card.firstChild?.firstChild as HTMLElement | null
			return host ? { host, corner: "bottom", raise: rowLogoHeight(card, host) } : null
		}
		// the hero's metadata block has no artwork, only the title's logo image, which the badge mustn't cover
		const hero = card.querySelector<HTMLElement>('div[data-testid="title-metadata-main"]')
		if (hero) return { host: hero, corner: "bottom", fit: false }
		return { host: card, corner: "bottom", raise: logoHeight(card) }
	},
	rowItem: (card) => card.closest<HTMLElement>("li") ?? card,
	searchGrids: () => gridsAround('article[data-card-title], article[data-testid*="-card"]', "article"),
	// the same two player roots the playback engine looks for; newer players only have #dv-web-player
	isPlayerPage: () => !!document.querySelector(".dv-player-fullscreen video, #dv-web-player video"),
	creditsFromEnd: markedCreditsFromEnd,
	playingTitle: () => document.title,
	playingEpisode: () => episodeFromPlayer(episodeInfo() ?? undefined, prime.showTitle()),
	// the next-up row comes up within seconds of the end credits Prime marks in its own playback data. The player keeps
	// hidden, zero-height next-up cards in the page all along, so only a card that takes up space counts.
	endScreenShowing: (video) =>
		video.duration - video.currentTime < 15 * 60 &&
		Array.from(document.querySelectorAll("[class*=nextupcard]")).some(
			(card) => card.getBoundingClientRect().height > 0,
		),
	// the next-up row fills the bottom, so the pill goes top right, under the player's top-right buttons and lined up
	// with the last of them. Prime scales those buttons with the player and drops them while its controls are hidden, so
	// the pill stays where they last were. Only the highest row on the right counts, not the X top left or an open menu.
	placeReview(review) {
		review.classList.add("sb-review-top")
		const width = document.documentElement.clientWidth
		const buttons = Array.from(document.querySelectorAll("#dv-web-player button, .dv-player-fullscreen button"))
			.filter((button) => !review.contains(button))
			.map((button) => button.getBoundingClientRect())
			.filter((rect) => rect.width > 0 && rect.top >= 0 && rect.bottom < innerHeight / 4 && rect.left > width / 2)
		if (!buttons.length) return
		const rowTop = Math.min(...buttons.map((rect) => rect.top))
		const row = buttons.filter((rect) => rect.top - rowTop < 4)
		const right = Math.max(0, width - Math.max(...row.map((rect) => rect.right)))
		review.style.setProperty("--sb-review-right", `${Math.round(right)}px`)
		review.style.setProperty("--sb-review-top", `${Math.round(Math.max(...row.map((rect) => rect.bottom)) + 12)}px`)
	},
}

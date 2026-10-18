import { disney, episodeLabel, playerQuery, playing } from "@/playback/sites/disney"
import type { PlayerClock } from "@/utils/credits-review"
import { parseEpisodeLabel } from "@/utils/series-finale"
import { markedCreditsFromEnd, pagePlayhead } from "../credits-marker"
import { gridsAround } from "./dom"
import type { MediaType, RatingsSite } from "./types"

// the tags Disney+ puts before or after a title in a card's label: badges ("New Badge", "Season Finale Badge"), and the
// network or brand it's from
const BADGE = /^(?:[A-Z][\w-]*\s+){1,3}Badge\s+/
const NETWORKS =
	/^(?:(?:Disney\+|Hulu|Star) Original(?: Series| Movie)?|FX|ESPN\+?|ESPN2|ABC News|National Geographic)\s+|\s+(?:(?:Disney\+|Hulu|Star) Original(?: Series| Movie)?|FX|ESPN\+?|ESPN2|ABC News|National Geographic)$/
// where the title in a label ends: the rating, year, call to action, or what's left of a part-watched title
const AFTER_TITLE =
	/\s+(?:Rated\s|Released\s\d{4}|Select (?:for details|to watch)|Season \d+ Episode \d+|(?:\d+ hours? )?\d+ minutes? remaining|Less than 1 minute remaining|Watch Next Episode)[\s\S]*$/

// "Hulu Original Series New Badge Rivals Rated TV-MA Released 2024. Drama Select for details on this title." -> "Rivals"
export function titleFromLabel(label: string | null | undefined): string | undefined {
	let title = (label ?? "").replaceAll("\u00a0", " ").replace(AFTER_TITLE, "").trim()
	for (let before = ""; before !== title;) {
		before = title
		title = title.replace(BADGE, "").replace(NETWORKS, "").trim()
	}
	return title || undefined
}

// cards that aren't a film or a show: extras and trailers on a title page, its episode list, live and replayed sports,
// and the brand tiles (Pixar, Marvel) that link to a brand's page
const notATitle = (card: HTMLElement, label: string) =>
	/^(?:Select to watch|Season \d+ Episode \d+|LIVE|Replay|Upcoming)\b/.test(label) ||
	!/^\/(?:browse\/entity-|play\/)/.test(card.getAttribute("href") ?? "")

// a part-watched title links to the player, and names what it is in the line under it
const continueWatching = (card: HTMLElement) =>
	card
		.closest('[data-testid="cw-set-item-wrapper"]')
		?.querySelector<HTMLElement>('[data-testid="cw-set-item-metadata"]')

// the playhead in the title, from the page; the <video> only says whether it's paused
function playerClock(): PlayerClock | null {
	const playhead = pagePlayhead()
	const video = disney.video()
	if (!playhead || !video) return null
	return { currentTime: playhead.position, duration: playhead.duration, paused: video.paused }
}

export const disneySite: RatingsSite = {
	service: "Disney",
	// Disney+ puts its "New" badges along the bottom of the artwork; the top-right is clear
	badge: { corner: "top", zIndex: "2" },
	titleCards: () => [document.querySelectorAll('a[data-testid="set-item"]:not(.imdb)')],
	seenMarker: (card) => card,
	cleanTitle(card) {
		const label = card.getAttribute("aria-label") ?? ""
		if (notATitle(card, label)) return undefined
		const metadata = continueWatching(card)
		if (metadata) return metadata.children[1]?.textContent?.trim() || titleFromLabel(label)
		// a poster's title art, or the poster itself, carries the bare title; the rating badge is an image too
		const art = card.querySelector<HTMLImageElement>(
			'[data-testid="poster-vertical-title-art"] img[alt], [data-testid="poster-set-item-background"] > img[alt]',
		)
		return art?.alt.trim() || titleFromLabel(label)
	},
	mediaType(card, url): MediaType {
		const label = card.getAttribute("aria-label") ?? ""
		if (/\bSeason \d+ Episode \d+\b|New (?:Series|Episode|Season) Badge|\bDocuseries\b/.test(label)) return "tv"
		if (/New Movie Badge/.test(label)) return "movie"
		if (/\/browse\/series\b/.test(url)) return "tv"
		if (/\/browse\/movies\b/.test(url)) return "movie"
		return null
	},
	// the artwork box, first thing in the card; the card itself also holds a part-watched title's progress bar
	badgeHost(card) {
		const host = card.firstElementChild
		return host instanceof HTMLElement ? { host, corner: "top" } : null
	},
	rowItem: (card) =>
		card.closest<HTMLElement>('[data-testid="set-shelf-item"], [data-testid="cw-set-item-wrapper"]') ?? card,
	searchGrids: () =>
		location.pathname.startsWith("/browse/search")
			? gridsAround('a[data-testid="set-item"]', 'a[data-testid="set-item"]')
			: [],
	isPlayerPage: () => location.pathname.startsWith("/play/"),
	playerClock,
	creditsFromEnd: markedCreditsFromEnd,
	playingTitle: () => disney.showTitle(),
	// films, and the last episode of a limited series; TMDb's episode counts say which is the last
	playingEpisode() {
		const label = episodeLabel()
		if (label === undefined) return undefined
		const place = parseEpisodeLabel(label)
		const show = disney.showTitle()
		return place && show ? { show, ...place } : null
	},
	// a film's end screen shrinks the player into a corner beside what to watch next; an episode's end card counts
	// down to the next one
	endScreenShowing: () =>
		!!document.querySelector('[data-testid="explore-post-play-view"]') ||
		!!playerQuery('[data-qa="end-card-overlay.countdown"]'),
	placeReview: () => {},
}

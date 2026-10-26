import type { SiteAdapter, SkipKind } from "../types"
import { $, mainVideo, parseEpisodeNumber, parseSeason } from "./dom"

// the page's path without a language prefix ("/pt-br/watch/…" → "/watch/…")
export const crunchyrollPath = (path = location.pathname) => path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, "")

// the episode or film on this player page, /watch/<id>/<slug>
const watchId = () => /^\/watch\/([A-Z0-9]+)(?:\/|$)/.exec(crunchyrollPath())?.[1] ?? null

// "E1 - Asta and Yuno" for an episode; a film's page names only the film
export const episodeTitle = () => $(".erc-current-media-info h1")?.textContent?.trim()

// Crunchyroll's own skip times for an episode, the file its player reads: { intro: { start, end }, credits: … } in
// seconds. Its one skip button is labelled in the profile's language, so these say which skip it is offering.
type Span = { start: number; end: number }
export type SkipEvents = Partial<Record<"intro" | "recap" | "credits", Span>>
const skipEvents = new Map<string, SkipEvents | null>()

export function parseSkipEvents(json: unknown): SkipEvents {
	const events: SkipEvents = {}
	for (const kind of ["intro", "recap", "credits"] as const) {
		const span = (json as Record<string, { start?: unknown; end?: unknown } | undefined> | null)?.[kind]
		if (typeof span?.start === "number" && typeof span.end === "number" && span.end > span.start)
			events[kind] = { start: span.start, end: span.end }
	}
	return events
}

export function playingSkipEvents() {
	const id = watchId()
	if (!id) return undefined
	if (!skipEvents.has(id)) {
		skipEvents.set(id, null)
		fetch(`https://static.crunchyroll.com/skip-events/production/${id}.json`)
			.then((response) => (response.ok ? response.json() : null))
			.then((json) => skipEvents.set(id, parseSkipEvents(json)))
			.catch(() => skipEvents.delete(id))
	}
	return skipEvents.get(id) ?? undefined
}

const player = () => $("#player-container")

// The skip button only exists while the player's controls are up, so inside a skip the controls are woken the way a
// mouse over the player would
function skipButton(kind: SkipKind): HTMLElement | null {
	if (kind === "stillWatching") return null
	// a film's "Skip Credits" leaves the film, and the review pill comes up in its credits
	if (kind === "credits" && crunchyroll.episodeNumber() === null) return null
	const span = playingSkipEvents()?.[kind]
	const video = crunchyroll.video()
	if (!span || !video || video.currentTime < span.start || video.currentTime >= span.end) return null
	const button = $('[data-testid="player-controls-root"] button[data-variant="primary"]')
	if (!button) player()?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }))
	return button
}

export const crunchyroll: SiteAdapter = {
	service: "Crunchyroll",
	video: () => (watchId() ? mainVideo(player() ?? document) : null),
	playerRoot: player,
	skipButton,
	// a seek on its <video> leaves the player buffering for good, so skips press its own button
	seekBlocked: true,
	episodeKey: watchId,
	episodeNumber: () => (/^E\d+\b/.test(episodeTitle() ?? "") ? parseEpisodeNumber(episodeTitle()) : null),
	// the tab title starts "Season 1 Part 1 Asta and Yuno"
	episodeSeason: () => parseSeason(document.title),
	showTitle: () => $('a[data-t="show-title-link"] h4')?.textContent?.trim() || null,
}

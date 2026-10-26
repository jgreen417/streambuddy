import type { SiteAdapter, SkipKind } from "../types"
import { $, mainVideo, parseEpisodeNumber, parseSeason } from "./dom"

// the page's path without a language prefix ("/pt-br/watch/…", "/es-419/watch/…" → "/watch/…")
export const crunchyrollPath = (path = location.pathname) =>
	path.replace(/^\/[a-z]{2}(?:-(?:[a-z]{2}|\d{3}))?(?=\/)/i, "")

// the episode or film on this player page, /watch/<id>/<slug>
const watchId = () => /^\/watch\/([A-Z0-9]+)(?:\/|$)/.exec(crunchyrollPath())?.[1] ?? null

// "E1 - Asta and Yuno" for an episode; a film's page names only the film
export const episodeTitle = () => $(".erc-current-media-info h1")?.textContent?.trim()

// Crunchyroll's own skip times for an episode, the file its player reads: { intro: { start, end }, credits: … } in
// seconds. Its one skip button is labelled in the profile's language, so these say which skip it is offering.
type Span = { start: number; end: number }
export type SkipEvents = Partial<Record<"intro" | "recap" | "credits", Span>>
// an episode's skip times once fetched, else when it may be asked for again (a failed fetch waits a while)
const skipEvents = new Map<string, SkipEvents | number>()
const RETRY_MS = 30_000

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
	const known = skipEvents.get(id)
	if (typeof known === "object") return known
	if (known !== undefined && Date.now() < known) return undefined
	skipEvents.set(id, Date.now() + RETRY_MS)
	fetch(`https://static.crunchyroll.com/skip-events/production/${id}.json`)
		.then(async (response) => {
			// an episode without skip times has no file
			if (response.status === 404) skipEvents.set(id, {})
			else if (response.ok) skipEvents.set(id, parseSkipEvents(await response.json()))
		})
		.catch(() => {})
	return undefined
}

const player = () => $("#player-container")
// when the controls were last woken, so a button that doesn't come up isn't asked for on every tick
let wokenAt = 0

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
	if (!button && Date.now() - wokenAt > 2_000) {
		wokenAt = Date.now()
		player()?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }))
	}
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

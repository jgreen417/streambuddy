import { markerForEntity, pagePlayhead } from "@/content-script/credits-marker"
import type { PlayerClock } from "@/utils/credits-review"
import { parseEpisodeLabel } from "@/utils/series-finale"
import type { SiteAdapter, SkipKind } from "../types"
import { $, mainVideo, parseSeason } from "./dom"

// Disney+'s player is built of web components, each drawing its controls in its own (open) shadow root
export function playerQuery<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
	const found = root.querySelector<T>(selector)
	if (found) return found
	for (const el of Array.from(root.querySelectorAll("*"))) {
		const inner = el.shadowRoot && playerQuery<T>(selector, el.shadowRoot)
		if (inner) return inner
	}
	return null
}

// the page's path without a region prefix ("/en-gb/play/…" → "/play/…")
export const disneyPath = (path = location.pathname) => path.replace(/^\/[a-z]{2}(?:-(?:[a-z]{2}|\d{3}))?(?=\/)/i, "")

// the title on this player page, /play/<entity>
const entity = () => /^\/play\/([^/?#]+)/.exec(disneyPath())?.[1] ?? null

const player = () => $('[data-testid="disney-web-player-container"]') ?? $("disney-web-player")

// what's playing, as the player's own response names it (see utils/credits-markers.ts); the title overlay says the
// same, but only while the controls are up
export function playing() {
	const playhead = pagePlayhead()
	return playhead ? markerForEntity(entity(), playhead.duration) : undefined
}
// "S1:E1 Simpsons Roasting on an Open Fire" for an episode, undefined for a film
export function episodeLabel() {
	const found = playing()
	return found ? found.episode : (playerQuery('[data-qa="title-bug.subtitle"]')?.textContent?.trim() ?? undefined)
}

// the playhead in the title, from the page; the <video> only says whether it's paused
export function clock(): PlayerClock | null {
	const playhead = pagePlayhead()
	const video = disney.video()
	if (!playhead || !video) return null
	return { currentTime: playhead.position, duration: playhead.duration, paused: video.paused }
}

const RECAP = /recap|rückblick|résumé|récap|resumen|riassunto|riepilogo|samenvatting|resumo/i

function skipButton(kind: SkipKind): HTMLElement | null {
	switch (kind) {
		// one skip button, labelled "Skip Intro" or "Skip Recap" in the profile's language: anything not a recap is the intro
		case "intro":
		case "recap": {
			const button = playerQuery('[data-qa="skip-overlay.skipButton"]')?.shadowRoot?.querySelector("button")
			if (!button) return null
			return RECAP.test(button.textContent ?? "") === (kind === "recap") ? button : null
		}
		// an episode's end card plays the next one
		case "credits":
			return playerQuery('[data-qa="end-card-overlay.contentTile"]')
		case "stillWatching":
			return null
	}
}

export const disney: SiteAdapter = {
	service: "Disney",
	video: () => (disneyPath().startsWith("/play/") ? mainVideo(player() ?? document) : null),
	clock,
	playerRoot: player,
	// the title, which sits higher than the back button beside it
	topBarAnchor: () => playerQuery('[data-qa="title-bug.title"]'),
	skipButton,
	// a seek on the <video> only moves within the stretch the player has loaded, so skips press its own buttons
	seekBlocked: true,
	episodeKey: entity,
	episodeNumber: () => parseEpisodeLabel(episodeLabel())?.episode ?? null,
	episodeSeason: () => parseSeason(episodeLabel()),
	showTitle: () =>
		playing()?.title ||
		playerQuery('[data-qa="title-bug.title"]')?.textContent?.trim() ||
		document.title.replace(/\s*\|\s*Disney\+$/, "").trim() ||
		null,
}

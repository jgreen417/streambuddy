import type { SiteAdapter } from "../types"
import { $, mainVideo, parseEpisodeNumber, parseSeason } from "./dom"

// the page's path without a language prefix ("/pt-br/watch/…" → "/watch/…")
export const crunchyrollPath = (path = location.pathname) => path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, "")

// the episode or film on this player page, /watch/<id>/<slug>
const watchId = () => /^\/watch\/([A-Z0-9]+)(?:\/|$)/.exec(crunchyrollPath())?.[1] ?? null

// "E1 - Asta and Yuno" for an episode; a film's page names only the film
export const episodeTitle = () => $(".erc-current-media-info h1")?.textContent?.trim()

export const crunchyroll: SiteAdapter = {
	service: "Crunchyroll",
	video: () => (watchId() ? mainVideo() : null),
	playerRoot: () => $(".video-player-wrapper"),
	skipButton: () => null,
	episodeKey: watchId,
	episodeNumber: () => (/^E\d+\b/.test(episodeTitle() ?? "") ? parseEpisodeNumber(episodeTitle()) : null),
	// the tab title starts "Season 1 Part 1 Asta and Yuno"
	episodeSeason: () => parseSeason(document.title),
	showTitle: () => $('a[data-t="show-title-link"] h4')?.textContent?.trim() || null,
}

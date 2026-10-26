import type { SiteAdapter, SkipKind } from "../types"
import { $, mainVideo, parseClock, parseEpisodeNumber, parseSeason } from "./dom"
import { fetchNetflixMetadata, parseNetflixCredits } from "@/utils/netflix-credits"

const SKIP_SELECTORS: Record<SkipKind, string> = {
	intro: '[data-uia="player-skip-intro"]',
	recap: '[data-uia="player-skip-recap"], [data-uia="player-skip-preplay"]',
	// the "Next episode" button that drains during the credits
	credits: '[data-uia="next-episode-seamless-button-draining"], [data-uia="next-episode-seamless-button"]',
	stillWatching: '[data-uia="interrupt-autoplay-continue"]',
}

// the player often labels only the episode ("E5"); the season then comes from Netflix's metadata for this title
let metadataSeason: { id: string; season: number | null } | null = null
function seasonFromMetadata() {
	const id = /\/watch\/(\d+)/.exec(location.pathname)?.[1]
	if (!id) return null
	if (metadataSeason?.id !== id) {
		const current: { id: string; season: number | null } = { id, season: null }
		metadataSeason = current
		fetchNetflixMetadata(id).then((json) => (current.season = parseNetflixCredits(json)?.episode?.season ?? null))
	}
	return metadataSeason.season
}

export const netflix: SiteAdapter = {
	service: "Netflix",
	video: () => (location.pathname.startsWith("/watch") ? mainVideo($(".watch-video") ?? document) : null),
	playerRoot: () => $('[data-uia="watch-video"]') ?? $(".watch-video"),
	topBarAnchor: () => $('[data-uia="control-nav-back"]'),
	skipButton: (kind) => $(SKIP_SELECTORS[kind]),
	// ad tiers show a countdown in the top corner of the player
	adRemaining: () => parseClock($('[data-uia="ads-info-time-remaining"], span[class*="mmvz9h"]')?.textContent),
	adStrategy: "fastForward",
	seekBlocked: true,
	episodeKey: () => /\/watch\/(\d+)/.exec(location.pathname)?.[1] ?? null,
	// <div data-uia="video-title"><h4>Show</h4><span>E5</span><span>Episode name</span></div>
	episodeNumber: () => parseEpisodeNumber($('[data-uia="video-title"] span')?.textContent),
	episodeSeason: () => parseSeason($('[data-uia="video-title"] span')?.textContent) ?? seasonFromMetadata(),
	// Netflix has its own speed menu (up to 1.5×)
	hasNativeSpeedControl: () => true,
	showTitle: () =>
		$('[data-uia="video-title"] h4')?.textContent?.trim() || $('[data-uia="video-title"]')?.textContent?.trim() || null,
}

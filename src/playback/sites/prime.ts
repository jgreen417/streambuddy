import type { SiteAdapter, SkipKind } from "../types"
import { $, buttonWithText, mainVideo, parseClock, parseEpisodeNumber } from "./dom"

const player = () => $(".dv-player-fullscreen") ?? $("#dv-web-player")
const episodeInfo = () =>
	($(".atvwebplayersdk-episode-info") ?? $(".atvwebplayersdk-subtitle-text"))?.textContent?.trim() || null

function skipButton(kind: SkipKind): HTMLElement | null {
	switch (kind) {
		// Prime uses one "skip element" for both intros and recaps; its label says which
		case "intro":
			return buttonWithText("[class*=skipelement]", /intro|vorspann|générique/i) ?? $("[class*=skipelement]")
		case "recap":
			return buttonWithText("[class*=skipelement]", /recap|rückblick|résumé|riassunto/i)
		case "credits":
			return $("[class*=nextupcard-button]")
		case "stillWatching":
			return null
	}
}

export const prime: SiteAdapter = {
	service: "Amazon",
	video: () => {
		const root = player()
		return root ? mainVideo(root) : null
	},
	playerRoot: player,
	skipButton: (kind) => {
		const button = skipButton(kind)
		// "Skip intro" detection falls back to any skip element, so it must not also claim a recap
		if (kind === "intro" && button && /recap|rückblick|résumé|riassunto/i.test(button.textContent ?? "")) return null
		return button
	},
	adRemaining: () => parseClock($(".atvwebplayersdk-ad-timer-remaining-time")?.textContent),
	adStrategy: "seek",
	// "S5 E3 Every One of You Sons of Bitches" (older players used a subtitle element)
	episodeKey: () => {
		const title = $(".atvwebplayersdk-title-text")?.textContent?.trim()
		return title ? `${title}|${episodeInfo() ?? ""}` : null
	},
	episodeNumber: () => parseEpisodeNumber(episodeInfo()),
	showTitle: () => $(".atvwebplayersdk-title-text")?.textContent?.trim() || null,
}

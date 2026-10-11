import type { SiteAdapter, SkipKind } from "../types"
import { $, buttonWithText, mainVideo, parseClock, parseEpisodeNumber } from "./dom"

const player = () => $(".dv-player-fullscreen") ?? $("#dv-web-player")

function skipButton(kind: SkipKind): HTMLElement | null {
	switch (kind) {
		// Prime uses one "skip element" for both intros and recaps; its label says which
		case "intro":
			return buttonWithText("[class*=skipelement]", /intro|vorspann|générique|intro/i) ?? $("[class*=skipelement]")
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
	episodeKey: () => {
		const title = $(".atvwebplayersdk-title-text")?.textContent?.trim()
		const subtitle = $(".atvwebplayersdk-subtitle-text")?.textContent?.trim()
		return title ? `${title}|${subtitle ?? ""}` : null
	},
	episodeNumber: () => parseEpisodeNumber($(".atvwebplayersdk-subtitle-text")?.textContent),
	showTitle: () => $(".atvwebplayersdk-title-text")?.textContent?.trim() || null,
}

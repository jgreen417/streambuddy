import type { SiteAdapter, SkipKind } from "../types"
import { $, buttonWithText, mainVideo, parseClock, parseEpisodeNumber, parseSeason } from "./dom"

function skipButton(kind: SkipKind): HTMLElement | null {
	switch (kind) {
		// one skip button, labelled "Skip Intro" or "Skip Recap"
		case "intro":
			return buttonWithText('button[class*="SkipButton-"], [data-testid="player-ux-skip-button"]', /intro/i)
		case "recap":
			return buttonWithText('button[class*="SkipButton-"], [data-testid="player-ux-skip-button"]', /recap/i)
		case "credits":
			return $('button[class*="UpNextButton-"], [data-testid="player-ux-up-next-button"]')
		case "stillWatching":
			return buttonWithText("button", /^\s*(continue watching|keep watching)\s*$/i)
	}
}

export const hbo: SiteAdapter = {
	service: "HBO",
	video: () => (location.pathname.startsWith("/video/watch") ? mainVideo() : null),
	playerRoot: () => {
		const video = mainVideo()
		return (
			video?.closest<HTMLElement>('[data-testid*="player" i], [class*="PlayerRoot" i], [class*="player-root" i]') ??
			video?.parentElement?.parentElement ??
			null
		)
	},
	skipButton,
	// ads are stitched into the title's own stream; the timer reads "1 of 3" then ":25", the seconds left in this ad
	// only, and Max lets the <video> be seeked past it (only its own scrubber holds you to a break)
	adRemaining: () => parseClock($('[data-testid="player-ux-ad-timer"] [class*="AdTimeRemainingText"]')?.textContent),
	adStrategy: "seek",
	episodeKey: () => /\/video\/watch\/([^/?#]+(?:\/[^/?#]+)?)/.exec(location.pathname)?.[1] ?? null,
	episodeNumber: () => parseEpisodeNumber($('[data-testid="player-ux-season-episode"]')?.textContent),
	episodeSeason: () => parseSeason($('[data-testid="player-ux-season-episode"]')?.textContent),
	showTitle: () =>
		$('[data-testid="player-ux-asset-title"]')?.textContent?.trim() ||
		document.title.split(/\s+[•|·-]\s+/)[0]?.trim() ||
		null,
}

import { hbo } from "@/playback/sites/hbo"
import { episodeFromPlayer, gridsAround, text } from "./dom"
import { markedCreditsFromEnd } from "../credits-marker"
import type { RatingsSite } from "./types"

// A tile's label is "⁦⁨⁨Title⁩⁩. ⁨1 of 20⁩. ⁨⁨Leaving Soon⁩⁩⁩": the title is the first isolated run
export function fixTitle(label: string | null | undefined): string | undefined {
	if (!label) return undefined
	const firstPart = label.includes("⁩") ? label.slice(0, label.indexOf("⁩")) : label
	const title = firstPart.replaceAll(/[⁦-⁩‎‏]/g, "").trim()
	return title || undefined
}

const TITLE_PAGES = ["show", "series", "movie", "topical", "standalone"]

export const maxSite: RatingsSite = {
	service: "HBO",
	badge: { corner: "bottom", zIndex: "2" },
	titleCards: () => [document.querySelectorAll("a[class*='StyledTileLinkNormal-']:not(.imdb)")],
	seenMarker: (card) => card,
	cleanTitle(card) {
		const href = card.getAttribute("href") || ""
		if (!TITLE_PAGES.some((page) => href.includes(page))) return undefined
		return fixTitle(card.getAttribute("aria-label")) ?? card.querySelector("p[class*='md_strong-']")?.textContent ?? ""
	},
	mediaType(card) {
		const href = card.getAttribute("href") || ""
		if (href.includes("show") || href.includes("series")) return "tv"
		if (href.includes("movie")) return "movie"
		return null
	},
	// the tile link itself is unpositioned; the poster container is the relative box
	badgeHost: (card) => ({
		host: card.querySelector<HTMLElement>('[data-testid$="_tileImage"]') ?? card,
		corner: "bottom",
	}),
	rowItem: (card) => card,
	searchGrids: () => gridsAround('a[data-testid$="_tile"]', 'a[data-testid$="_tile"]'),
	isPlayerPage: () => location.pathname.includes("/video/watch"),
	creditsFromEnd: markedCreditsFromEnd,
	playingTitle: () => document.title,
	// the player can be missing its show title
	playingEpisode: () => episodeFromPlayer(text('[data-testid="player-ux-season-episode"]'), hbo.showTitle()),
	endScreenShowing: () => false,
	placeReview: () => {},
}

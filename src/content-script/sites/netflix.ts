import { fetchNetflixMetadata, parseNetflixCredits, type NetflixCredits } from "@/utils/netflix-credits"
import { NetflixShowTitles, getEpisodeId } from "@/utils/netflix-shows"
import type { RatingsSite } from "./types"

const showTitles = new NetflixShowTitles()

// labelled with the episode name, so the series title is looked up (see netflix-shows.ts)
const isEpisodeCard = (card: HTMLElement) => card.dataset.uia === "episodic-card"

// Netflix's metadata for the title on /watch/{id}, which marks when its credits start
let playing: { id: string; credits?: NetflixCredits | null } | null = null
function creditsMetadata() {
	const id = location.pathname.match(/^\/watch\/(\d+)/)?.[1]
	if (!id) return undefined
	if (playing?.id !== id) {
		const current: NonNullable<typeof playing> = { id }
		playing = current
		fetchNetflixMetadata(id).then((json) => {
			current.credits = parseNetflixCredits(json)
		})
	}
	return playing.credits ?? undefined
}

export const netflixSite: RatingsSite = {
	service: "Netflix",
	// Netflix draws its "Recently added" and "Leaving soon" tags into the bottom of the boxart; the top-right is clear
	badge: { corner: "top", right: "calc(0.2vw + 3px)", zIndex: "2" },
	titleCards: () => [
		document.querySelectorAll(
			'a[data-uia="standard-card"]:not(.imdb), a[data-uia="progress-card"]:not(.imdb), a[data-uia="ranked-card"]:not(.imdb), a[data-uia="episodic-card"]:not(.imdb)',
		),
	],
	seenMarker: (card) => card,
	cleanTitle(card) {
		if (isEpisodeCard(card)) {
			const episodeId = getEpisodeId(card.getAttribute("href"))
			return (episodeId && showTitles.get(episodeId)) || undefined
		}
		return card.getAttribute("aria-label")?.split(" (")[0]
	},
	mediaType(card, url) {
		if (isEpisodeCard(card) || url.includes("genre/83")) return "tv"
		if (url.includes("genre/34399")) return "movie"
		return null
	},
	titlePending: (card) =>
		isEpisodeCard(card) && showTitles.get(getEpisodeId(card.getAttribute("href")) ?? "") === undefined,
	badgeHost(card) {
		const host = card.closest<HTMLElement>("div[data-virtual-slot]") ?? card.parentElement
		if (!host) return null
		if (getComputedStyle(host).position === "static") host.style.position = "relative"
		return { host, corner: "top" }
	},
	rowItem: (card) => card.closest<HTMLElement>("[data-virtual-slot]") ?? card.parentElement ?? card,
	searchGrids: () =>
		Array.from(document.querySelectorAll<HTMLElement>('[data-uia="search-page"] section[data-uia="gallery"]')),
	isPlayerPage: () => location.pathname.startsWith("/watch"),
	creditsMetadata,
	playingTitle: (metadata) => metadata?.title ?? document.querySelector('[data-uia="video-title"] h4')?.textContent,
	playingEpisode(metadata) {
		if (!metadata || metadata.movie) return undefined
		const episode = metadata.episode
		return episode?.last ? { show: metadata.title, season: episode.season, episode: episode.number } : null
	},
	endScreenShowing: () => !!document.querySelector('[data-uia="postplay-player-space"]'),
	// Netflix previews the next title bottom right, so the pill lines up with its back arrow bottom left
	placeReview(review) {
		review.classList.add("sb-review-left")
		const back = document.querySelector('[data-uia="control-nav-back"]')?.getBoundingClientRect()
		if (back?.width) review.style.setProperty("--sb-review-left", `${Math.round(back.left)}px`)
	},
}

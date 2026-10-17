// Runs streamBuddy's own site-reading code on whatever page it's put in, and reports what that code makes of the
// page: the cards it would rate and where their badges would go, the player it would drive, the episodes it would
// chip. Bundled into a page script by bundle.ts, so it works the same on a saved fixture and on the live site, and
// two reports can be diffed to see exactly where a site has changed under us.
import { SERVICES, type StreamingService } from "@/constants/streamingServices"
import { maxSite } from "@/content-script/sites/max"
import { netflixSite } from "@/content-script/sites/netflix"
import { primeSite } from "@/content-script/sites/prime"
import type { RatingsSite } from "@/content-script/sites/types"
import { hbo } from "@/playback/sites/hbo"
import { netflix } from "@/playback/sites/netflix"
import { prime } from "@/playback/sites/prime"
import type { SiteAdapter, SkipKind } from "@/playback/types"
import { readDetailContext, readEpisodeCards } from "@/utils/page-features"
import { freeze } from "./freeze"

const SITES: Record<StreamingService, { ratings: RatingsSite; playback: SiteAdapter }> = {
	Netflix: { ratings: netflixSite, playback: netflix },
	Amazon: { ratings: primeSite, playback: prime },
	HBO: { ratings: maxSite, playback: hbo },
}
const SKIPS: SkipKind[] = ["intro", "recap", "credits", "stillWatching"]

// an element as a reader can find it again: tag plus the attribute the sites themselves name things by
function describe(el: Element | null | undefined) {
	if (!el) return null
	const id = ["data-uia", "data-testid", "data-card-title"]
		.map((name) => el.getAttribute(name) && `[${name}="${el.getAttribute(name)}"]`)
		.find(Boolean)
	return el.tagName.toLowerCase() + (id ?? (el.id ? `#${el.id}` : ""))
}

function cards(site: RatingsSite) {
	return site.titleCards().flatMap((list, kind) =>
		Array.from(list as NodeListOf<HTMLElement>, (card) => {
			const host = site.badgeHost(card)
			const box = host?.host.getBoundingClientRect()
			return {
				kind,
				title: site.cleanTitle(card, kind) ?? null,
				mediaType: site.mediaType(card, location.href),
				pending: site.titlePending?.(card) ?? false,
				seenMarker: describe(site.seenMarker(card, kind)),
				rowItem: describe(site.rowItem(card)),
				badge: host && {
					host: describe(host.host),
					corner: host.corner,
					raise: host.raise === undefined ? null : Math.round(host.raise * 1000) / 1000,
					fit: host.fit ?? true,
					size: box && [Math.round(box.width), Math.round(box.height)],
				},
			}
		}),
	)
}

// where the review pill would go: the class and offsets placeReview gives it, read off a stand-in pill
function reviewPlacement(site: RatingsSite) {
	const review = document.createElement("div")
	site.placeReview(review)
	const offsets = Array.from(review.style, (name) => [name, review.style.getPropertyValue(name)])
	return { classes: [...review.classList], ...Object.fromEntries(offsets) }
}

function player(site: RatingsSite, adapter: SiteAdapter) {
	const video = adapter.video()
	const metadata = site.creditsMetadata?.()
	return {
		review: reviewPlacement(site),
		video: video && { duration: Math.round(video.duration), at: Math.round(video.currentTime) },
		root: describe(adapter.playerRoot()),
		skip: Object.fromEntries(SKIPS.map((kind) => [kind, describe(adapter.skipButton(kind))])),
		adRemaining: adapter.adRemaining?.() ?? null,
		episodeKey: adapter.episodeKey(),
		episodeNumber: adapter.episodeNumber(),
		showTitle: adapter.showTitle(),
		playingTitle: site.playingTitle(metadata) ?? null,
		playingEpisode: site.playingEpisode(metadata) ?? null,
		endScreen: video ? site.endScreenShowing(video) : null,
		creditsFromEnd: video ? (site.creditsFromEnd?.(video) ?? null) : null,
	}
}

export function probe(service: StreamingService) {
	const { ratings, playback } = SITES[service]
	const feature = SERVICES[service].feature
	const onPlayer = ratings.isPlayerPage()
	return {
		url: location.href,
		service,
		ratesCards: ratings.ratesCards?.() ?? true,
		cards: cards(ratings),
		searchGrids: ratings.searchGrids().map(describe),
		detail: readDetailContext(feature),
		episodes: readEpisodeCards(feature, document.body).map(({ card, target, season, episode }) => ({
			season,
			episode,
			card: describe(card),
			target: describe(target),
		})),
		player: onPlayer ? player(ratings, playback) : null,
	}
}
export type ProbeReport = ReturnType<typeof probe>

;(globalThis as { sbProbe?: typeof probe }).sbProbe = probe
// capture.ts freezes the page with this copy, as functions handed to page.evaluate from tsx don't survive the trip
;(globalThis as { sbFreeze?: typeof freeze }).sbFreeze = freeze

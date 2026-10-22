// Finds the title cards on the page, gets each one's rating (from the cache or a lookup) and badges it. Also fades
// and hides cards per the row settings and re-sorts search results by rating.
import { debugLog } from "@/utils/log"
import { CheckedCards } from "@/utils/tmdb"
import { RowPresentation, isBelowRatingCutoff } from "@/utils/row-presentation"
import { SearchRatingSort } from "@/utils/page-features"
import { badgeLook } from "@/utils/page-feature-styles"
import { SERVICES } from "@/constants/streamingServices"
import { localDateKey } from "@/utils/stats"
import { TMDB_LOW_RATING, getNormalizedScore, getRatingVoteCount, isDimmed, placeBadge, renderBadge } from "./badge"
import {
	GCdiff,
	cached,
	getDiffInDays,
	isCacheCurrent,
	lookupMovieInfo,
	scheduleCacheSave,
	today,
	type MovieInfo,
} from "./cache"
import { getPersonalStatus, loggedRating } from "./profile"
import { overrideFor } from "./overrides"
import { settings } from "@/stores/settings"
import { ratingSources } from "./settings"
import type { RatingsSite } from "./sites/types"
import { queueSeenTitle } from "./watch-stats"

// the service this tab is on
let site: RatingsSite | null = null
export function startCards(service: RatingsSite) {
	site = service
	// a corrected match, here or in another tab: drop the wrong badges and let the next pass look the title up again
	browser.storage.onChanged.addListener((changes, area) => {
		if (area === "local" && changes.titleOverrides) refreshRowPresentation(true)
	})
	if (ratingsEnabled()) startShowRatingInterval()
}

// The same title often sits in several rows; share one lookup between all of its cards
const lookupsInFlight = new Map<string, Promise<MovieInfo | null>>()
const checkedCards = new CheckedCards()
// switching rating sources can turn an unrated title into a rated one, so a card is checked again under new sources
const temporaryResults = new Map<string, MovieInfo>()
const checkedKey = (title: string) => `${title}|${ratingSources()}`
async function getMovieInfo(
	title: string,
	card: HTMLElement,
	media_type: string | null = null,
	year: string | null = null,
) {
	const sources = ratingSources()
	const key = `${title}|${media_type ?? ""}|${year ?? ""}|${sources}`
	let lookup = lookupsInFlight.get(key)
	// a result kept out of the cache because a provider failed for a moment is reused until it's due a retry, so
	// other cards with the same title don't start their own lookups in the meantime
	const recent = temporaryResults.get(key)
	if (!lookup && recent && (recent.retryAfter ?? 0) > Date.now()) lookup = Promise.resolve(recent)
	if (!lookup) {
		lookup = lookupMovieInfo(title, media_type, year, sources)
			.then((info) => {
				if (info?.retryAfter) temporaryResults.set(key, info)
				else temporaryResults.delete(key)
				return info
			})
			.finally(() => lookupsInFlight.delete(key))
		lookupsInFlight.set(key, lookup)
	}
	const info = await lookup
	// the sources setting changed while this was being looked up: let the next pass look it up again
	if (sources !== ratingSources()) {
		releaseCard(card)
		return
	}
	if (info) setRatingOnCard(card, info, title)
	// no match, or TMDb unreachable: try this card again in a while rather than on every tick
	else checkedCards.mark(card, checkedKey(title), Date.now() + 30_000)
}

const rowPresentation = new RowPresentation()
const rowCardData = new WeakMap<HTMLElement, MovieInfo>()
const rowCardTitles = new WeakMap<HTMLElement, string>()
const rowCardDecorations = new WeakMap<HTMLElement, HTMLElement[]>()
// let the next pass pick the card up again
function releaseCard(card: HTMLElement) {
	card.classList.remove("imdb")
	card.closest("li")?.classList.remove("imdb")
}
// redrawAll: drop every card badge so the next pass draws it again (after a setting that changes how badges look)
export function refreshRowPresentation(redrawAll = false) {
	const stale = rowPresentation.prune((card) => {
		const retryAfter = rowCardData.get(card)?.retryAfter ?? Number.POSITIVE_INFINITY
		return (
			!redrawAll &&
			retryAfter > Date.now() &&
			site?.cleanTitle(card, card.dataset.cardTitle ? 0 : 1) === rowCardTitles.get(card)
		)
	})
	for (const card of stale) {
		rowCardDecorations.get(card)?.forEach((decoration) => decoration.remove())
		releaseCard(card)
		rowCardData.delete(card)
		searchSorting.forgetRating(card)
	}
	const enabled = ratingsEnabled()
	rowPresentation.refresh(
		{
			fadeWatched: !!enabled && settings.value.General.fadeWatched,
			hideBelow: !!enabled && settings.value.General.hideBelowRating,
		},
		(card) => {
			const data = rowCardData.get(card)
			return !!data && loggedRating(data) !== undefined
		},
		(card) => {
			const data = rowCardData.get(card)
			return (
				!!data &&
				isBelowRatingCutoff(
					data.source,
					data.source === "tmdb" ? data.score : (data.rating ?? 0),
					settings.value.General.dimBelowBand,
					getRatingVoteCount(data),
					TMDB_LOW_RATING,
				)
			)
		},
	)
}

const searchSorting = new SearchRatingSort()
export function updateSearchSorting() {
	if (!site || !settings.value.General.searchSort || !location.pathname.includes("search")) {
		searchSorting.clear()
		return
	}
	const grids = site.searchGrids()
	if (!grids.length) {
		searchSorting.clear()
		return
	}
	grids.forEach((grid) => searchSorting.update(grid))
}
// whether card ratings are switched on for the service the tab is on
export function ratingsEnabled() {
	return !!site && !!settings.value[site.service]?.showRating
}
function showRating() {
	return site?.ratesCards?.() ?? true
}
function startShowRatingInterval() {
	if (showRating()) addRating()
	// New cards get rated on the next frame after they appear instead of on the next 1s tick. Player pages mutate
	// constantly and have no cards, so they're ignored; the interval stays as a safety net and to stop when switched off.
	let stopped = false
	let tickScheduled = false
	const scheduleTick = () => {
		if (stopped || tickScheduled || document.hidden || site?.isPlayerPage()) return
		tickScheduled = true
		setTimeout(() => {
			tickScheduled = false
			if (!stopped && showRating()) addRating()
		}, 16)
	}
	const observer = new MutationObserver(scheduleTick)
	observer.observe(document.body, { childList: true, subtree: true })
	globalThis.addEventListener("scroll", scheduleTick, { passive: true, capture: true })
	const RatingInterval = setInterval(function () {
		refreshRowPresentation()
		if (!ratingsEnabled()) {
			debugLog("stopped adding Rating")
			clearInterval(RatingInterval)
			stopped = true
			observer.disconnect()
			globalThis.removeEventListener("scroll", scheduleTick, { capture: true })
			return
		}
		if (showRating()) addRating()
	}, 1000)
}
// DBCache logic
// 1. Condition No Cached Rating -> Fetch Rating
// 2. Condition No Rating but in Cache if cache older than 7 days -> Fetch Rating
// 3. Condition Cached Rating older than 30 days -> Fetch Rating
// 4. Condition Cached Rating older than 1 day, Vote count under 100 and Release date in the last 50 days -> Fetch Rating
// 5. Condition if media_type is not matching -> Fetch Rating
function useDBCache(entry: MovieInfo, title: string, card: HTMLElement, media_type: string | null) {
	entry.date ||= today()
	const vote_count = entry.vote_count || 100
	const diffInReleaseDate =
		// under 100 votes the rating is still settling
		vote_count < 100 &&
		// not refreshed in the last day
		getDiffInDays(entry.date, new Date()) > 1 &&
		// released in the last 50 days
		getDiffInDays(entry.release_date, new Date()) <= 50

	// refresh rating if older than 30 days or release date is in last month and vote count is under 100
	if (getDiffInDays(entry.date, new Date()) >= GCdiff || diffInReleaseDate) {
		if (diffInReleaseDate)
			debugLog(
				"update recent movie:",
				title,
				",refresh:",
				getDiffInDays(entry.date, new Date()),
				",Age:",
				getDiffInDays(entry.release_date, new Date()),
				"Vote count:",
				vote_count,
			)
		else debugLog("update old rating:", title, ",Age:", getDiffInDays(entry.date, new Date()))
		getMovieInfo(title, card, media_type)
	} else {
		setRatingOnCard(card, entry, title)
	}
}
// "Visible" includes one screen ahead (below, and to the right for rows), so the next row is usually rated
// before you scroll to it instead of starting its lookups only once it's on screen.
const LOOKAHEAD_SCREENS = 1
function isElementVisible(el: HTMLElement): boolean {
	const rect = el.getBoundingClientRect()
	const height = window.innerHeight || document.documentElement.clientHeight
	const width = window.innerWidth || document.documentElement.clientWidth
	return (
		rect.bottom > 0 &&
		rect.right > 0 &&
		rect.top < height * (1 + LOOKAHEAD_SCREENS) &&
		rect.left < width * (1 + LOOKAHEAD_SCREENS)
	)
}

async function addRating() {
	if (!site) return
	const url = globalThis.location.href
	const AllTitleCardsTypes = site.titleCards()
	// a card can hold several images of the same title, so only use the first one
	let lastTitle = ""
	// for each is not going in order on chrome
	let updateDBCache = false
	for (let type = 0; type < AllTitleCardsTypes.length; type++) {
		const titleCards = AllTitleCardsTypes[type]
		for (let i = 0; i < titleCards.length; i++) {
			const card = titleCards[i] as HTMLElement
			const marker = site.seenMarker(card, type)
			marker?.classList.add("imdb")
			const media_type = site.mediaType(card, url)
			const title = site.cleanTitle(card, type)
			if (!title) {
				// a card whose title is still being worked out gets another pass once it's known
				if (site.titlePending?.(card)) card.classList.remove("imdb")
				continue
			}
			if (checkedCards.isChecked(card, checkedKey(title))) continue
			// sometimes more than one image is loaded for the same title
			if (lastTitle == title || title.includes("Netflix") || title.includes("Prime Video")) continue
			lastTitle = title
			const entry = cached(title)
			const override = overrideFor(title)
			if (
				entry &&
				isCacheCurrent(entry) &&
				// a corrected title must not reuse the wrong match still sitting in the cache, and its type wins over the card's
				(override
					? entry.id === override.id && entry.media_type === override.media_type
					: !media_type || entry.media_type == media_type) &&
				// a Letterboxd/IMDb rating counts even when TMDb has no votes; unrated titles are retried after a week
				(entry.rating || entry.score || getDiffInDays(entry.date, new Date()) <= 7)
			) {
				useDBCache(entry, title, card, media_type)
			}
			// if element is not visible skip it
			else if (!isElementVisible(card)) marker?.classList.remove("imdb")
			else {
				getMovieInfo(title, card, media_type)
				updateDBCache = true
			}
		}
	}
	if (updateDBCache) scheduleCacheSave()
}
async function setRatingOnCard(card: HTMLElement, data: MovieInfo, title: string) {
	if (!card.isConnected || !site) return
	if (site.cleanTitle(card, card.dataset.cardTitle ? 0 : 1) !== title) {
		releaseCard(card)
		return
	}
	// a card picked up again while its lookup was in flight waits on the same lookup; draw its badge only once
	if (rowCardTitles.get(card) === title && rowCardDecorations.get(card)?.[0]?.isConnected) return
	// nothing to say about this title: show nothing rather than a "?" or a meaningless 0.0
	const hasRating = (data.source !== "tmdb" && !!data.rating) || data.score > 0
	if (!hasRating) {
		debugLog("no score found:", title, data, card)
		// Prime's card selectors can't skip cards already seen, so remember it. A cached unrated title is looked up
		// again once the cache refreshes it (a week), which needs a page load anyway; a result left uncached because
		// Letterboxd/IMDb failed for a moment is retried shortly
		checkedCards.mark(card, checkedKey(title), cached(title) === data ? Number.POSITIVE_INFINITY : Date.now() + 30_000)
		return
	}
	const personal = getPersonalStatus(data)
	const div = renderBadge(data, {
		general: settings.value.General,
		look: badgeLook(settings.value.General),
		personal,
		position: site.badge,
		service: site.service,
		cardTitle: title,
	})
	if (data.source !== "tmdb" && data.rating) {
		queueSeenTitle(
			{
				title: data.title || title,
				source: data.source,
				rating: data.rating,
				url: data.rating_url ?? "",
				platform: SERVICES[site.service].statsKey,
				media_type: data.media_type,
				seen: localDateKey(new Date()),
			},
			{ watched: personal.watched !== undefined, watchlist: personal.watchlist },
		)
	}
	const vote_count = getRatingVoteCount(data)
	const dimmed =
		!!settings.value.Video?.dimLowRatings && isDimmed(data, vote_count < 50, settings.value.General.dimBelowBand)
	const decorations = placeBadge(div, site.badgeHost(card), dimmed)
	if (div.isConnected) {
		searchSorting.setRating(card, getNormalizedScore(data))
		rowCardData.set(card, data)
		rowCardTitles.set(card, title)
		rowCardDecorations.set(card, decorations)
		rowPresentation.track(card, site.rowItem(card))
		refreshRowPresentation()
	}
}

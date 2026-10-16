import { debugLog, logLookupFailure } from "@/utils/log"
import { color, ease, font, friendColors as FRIEND_DOT_COLORS, shadow } from "@/design/tokens"
import { applyGlass, installPageFeatureStyle } from "@/utils/page-feature-styles"
import { sendMessage } from "webext-bridge/content-script"
import {
	getLetterboxdSlug,
	getScoreBand,
	getScoreColor,
	type ExternalRating,
	type FriendRating,
	type LetterboxdProfile,
	type RatingSource,
} from "@/utils/ratings"
import { CheckedCards, isSeasonOnlyTitle, pickBestMatch } from "@/utils/tmdb"
import { getAccount, onAccountChanged } from "@/utils/account"
import type { StreamingService } from "@/constants/streamingServices"
import { RowPresentation, normalizeRowScore, isBelowRatingCutoff } from "@/utils/row-presentation"
import {
	EpisodeRatings,
	SearchRatingSort,
	type FeatureSite,
	type FeatureRating,
	type EpisodeRating,
} from "@/utils/page-features"
import { CreditsRatingPrompt, creditsLength, inCredits } from "@/utils/credits-review"
import { fetchNetflixMetadata, parseNetflixCredits, type NetflixCredits } from "@/utils/netflix-credits"
import { isLastEpisode, parseEpisodeLabel, shareLookup, type PlayingEpisode } from "@/utils/series-finale"
import { NetflixShowTitles, getEpisodeId } from "@/utils/netflix-shows"
import { hbo } from "@/playback/sites/hbo"
import { prime } from "@/playback/sites/prime"
import {
	addWatchSeconds,
	localDateKey,
	mergeSeenTitles,
	type SeenTitle,
	type SeenTop,
	type WatchLog,
	type WatchTimerState,
	watchTick,
} from "@/utils/stats"
debugLog("shared-functions loaded")
// Global Variables

// exported for tests
export const { data: settings, promise } = useBrowserSyncStorage<settingsType>("settings", defaultSettings)
export const date = new Date()
const today = date.toISOString().split("T")[0]

const ua = navigator.userAgent
const isMobile = /mobile/i.test(ua)
let url = globalThis.location.href
const hostname = globalThis.location.hostname
const title = document.title
let isPrimeVideo = /amazon|primevideo/i.test(hostname) && (/video/i.test(title) || /video/i.test(url))
let isNetflix = /netflix/i.test(hostname)
let isHBO = /max.com/i.test(hostname)
const htmlLang = document.documentElement.lang

let DBCache: DBCacheType = {}

export enum Platforms {
	Netflix = "netflix",
	Amazon = "amazon",
	HBO = "hbo",
}

let activePlatform: Platforms | null = null
export async function startSharedFunctions(platform: Platforms) {
	activePlatform = platform
	startWatchTimer(platform)
	loadLetterboxdProfile()
	if (platform == Platforms.Amazon) isPrimeVideo = true
	if (platform == Platforms.Netflix) isNetflix = true
	if (platform == Platforms.HBO) isHBO = true

	await promise
	getDBCache()
	startPageFeatures()
}
type MovieInfo = {
	id: number
	title: string
	score: number
	vote_count: number
	release_date: string
	media_type: string
	poster_path: string | null
	date: string
	db: string
	// where the badge's number comes from; TMDb is only used when neither Letterboxd nor IMDb has a rating
	source: RatingSource
	rating?: number
	rating_count?: number
	rating_url?: string
	friends_rating?: number
	friends_count?: number
	friends?: FriendRating[]
	retryAfter?: number
	cacheVersion?: number
	// the rating-source setting this was looked up under (missing on older entries, which used both)
	sources?: RatingSources
}
// bump when lookups change (and the seeded cacheVersion in e2e/visual/ratings.ts) so older entries (wrong matches, fallbacks saved during an outage) are refetched once
const CACHE_VERSION = 3
const ratingSources = () => settings.value.General.ratingSources
// a lookup takes the sources setting as it was when it started, so a change mid-lookup can't mislabel its result
const usesLetterboxd = (sources: RatingSources) => sources === "both" || sources === "letterboxd"
const usesImdb = (sources: RatingSources) => sources === "both" || sources === "imdb"
// cached under the current lookup rules and the current choice of sources
export const isCacheCurrent = (entry: MovieInfo | undefined) =>
	!entry?.retryAfter && entry?.cacheVersion === CACHE_VERSION && (entry.sources ?? "both") === ratingSources()
type DBCacheType = {
	[title: string]: MovieInfo
}
async function getDBCache() {
	const result = await browser.storage.local.get("DBCache")
	DBCache = result?.DBCache as DBCacheType
	if (typeof DBCache !== "object") {
		debugLog("DBCache not found, creating new one", DBCache)
		try {
			await browser.storage.local.set({ DBCache: {} })
		} catch (error) {
			console.error(error)
		}
		DBCache = {}
	}
	if (ratingsEnabled()) startShowRatingInterval()
	if (getDiffInDays(settings.value.General.GCdate, date) >= GCdiff) garbageCollection()

	browser.storage.onChanged.addListener(function (changes, areaName) {
		if (areaName === "local" && changes?.DBCache) DBCache = changes.DBCache.newValue as DBCacheType
	})
}
// set DB Cache if cache size under 5MB
async function setDBCache() {
	const size = new TextEncoder().encode(JSON.stringify(DBCache)).length
	const kiloBytes = size / 1024
	const megaBytes = kiloBytes / 1024
	if (megaBytes < 5) {
		debugLog("updateDBCache size:", megaBytes.toFixed(4) + " MB")
		await browser.storage.local.set({ DBCache })
	} else {
		debugLog("DBCache cleared", megaBytes)
		DBCache = {}
		await browser.storage.local.set({ DBCache })
	}
}

// how long a record should be kept in the cache
const GCdiff = 30
async function garbageCollection() {
	// clear every rating older than 30 days
	// clear every rating where db != tmdb
	debugLog("garbageCollection started, deleting old ratings:")
	const keys = Object.keys(DBCache)
	for (const key of keys) {
		if (getDiffInDays(DBCache[key].date, date) >= GCdiff || DBCache[key].db != "tmdb") {
			debugLog(DBCache[key].date, key)
			delete DBCache[key]
		}
	}
	settings.value.General.GCdate = today
	setDBCache()
}
// #region startSharedFuncs
type TMDBMovie = {
	adult: boolean
	backdrop_path: string
	genre_ids: Array<number>
	id: number
	original_language: string
	original_title: string
	original_name: string
	overview: string
	popularity: number
	poster_path: string
	release_date: string
	first_air_date: string
	title: string
	name: string
	video: boolean
	vote_average: number
	vote_count: number
	media_type: string
}
type TMDBResponse = {
	page: number
	results: Array<TMDBMovie>
	total_pages: number
	total_results: number
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
		card.classList.remove("imdb")
		if (isPrimeVideo) card.closest("li")?.classList.remove("imdb")
		return
	}
	if (info) setRatingOnCard(card, info, title)
	// no match, or TMDb unreachable: try this card again in a while rather than on every tick
	else checkedCards.mark(card, checkedKey(title), Date.now() + 30_000)
}

export async function lookupMovieInfo(
	title: string,
	media_type: string | null,
	year: string | null,
	sources: RatingSources = ratingSources(),
): Promise<MovieInfo | null> {
	const locale = htmlLang || navigator?.language || "en-US"
	const queryType = media_type ?? "multi"
	let url = `https://api.themoviedb.org/3/search/${queryType}?query=${encodeURIComponent(title)}&include_adult=false&language=${locale}&page=1`
	if (year) url += `&year=${year}`
	// start downloading the likely Letterboxd page now; it's verified against TMDb's answer before being used
	if (media_type !== "tv" && usesLetterboxd(sources))
		Promise.resolve(
			sendMessage("letterboxdPrefetch", { title, friends: settings.value.General.friendsRatings }, "background"),
		).catch(() => {})
	const data: TMDBResponse & { error?: string } = await sendMessage("fetch", { url, type: "tmdb" }, "background")
	// TMDb unreachable: show nothing and leave the title uncached so the next visit retries
	if (!data || data.error) return null
	const results = data.results?.filter((item) => item.media_type?.toLowerCase() !== "person")
	const movie = pickBestMatch(results, title)
	if (!movie?.id) return null
	const resolvedMediaType = queryType == "multi" ? movie?.media_type : queryType
	const external = movie?.id
		? await getExternalRating(movie.id, resolvedMediaType, title, sources)
		: { rating: null, transient: false }
	const compiledData: MovieInfo = {
		id: movie?.id,
		media_type: resolvedMediaType,
		score: movie?.vote_average,
		vote_count: movie?.vote_count,
		release_date: movie?.release_date || movie?.first_air_date,
		title: movie?.title || movie?.original_title || movie?.name || movie?.original_name,
		poster_path: movie?.poster_path ?? null,
		date: today,
		db: "tmdb",
		source: external.rating?.source ?? "tmdb",
		rating: external.rating?.rating,
		rating_count: external.rating?.rating_count,
		rating_url: external.rating?.url,
		friends_rating: external.rating?.friends_rating,
		friends_count: external.rating?.friends_count,
		friends: external.rating?.friends,
		cacheVersion: CACHE_VERSION,
		retryAfter: external.transient ? Date.now() + 30_000 : undefined,
		sources,
	}
	// a temporary Letterboxd/IMDb failure must not pin this title to the fallback for a month
	if (!external.transient) {
		DBCache[title] = compiledData
		scheduleCacheSave()
	}
	return compiledData
}

let cacheSaveTimer: ReturnType<typeof setTimeout> | undefined
function scheduleCacheSave() {
	cacheSaveTimer ??= setTimeout(() => {
		cacheSaveTimer = undefined
		setDBCache()
	}, 3000)
}

type ExternalResult = ExternalRating | null | { error: string }
const isLookupError = (result: ExternalResult): result is { error: string } => !!result && "error" in result
// Films: Letterboxd. TV, and films Letterboxd has no rating for yet: IMDb. The rating-source setting can drop either.
async function getExternalRating(
	tmdbId: number,
	media_type: string,
	title: string,
	sources: RatingSources,
): Promise<{ rating: ExternalRating | null; transient: boolean }> {
	let transient = false
	try {
		// Letterboxd's /tmdb/{id} only understands movie ids, a TV id would resolve to an unrelated film
		if (media_type === "movie" && usesLetterboxd(sources)) {
			const letterboxd: ExternalResult = await sendMessage(
				"letterboxdRating",
				{ tmdbId, friends: settings.value.General.friendsRatings, title },
				"background",
			)
			if (isLookupError(letterboxd)) transient = true
			else if (letterboxd?.rating) return { rating: letterboxd, transient: !!letterboxd.friends_unavailable }
		}
		if (!usesImdb(sources) || (media_type !== "movie" && media_type !== "tv")) return { rating: null, transient }
		const externalIds: { imdb_id?: string; error?: string } = await sendMessage(
			"fetch",
			{ url: `https://api.themoviedb.org/3/${media_type}/${tmdbId}/external_ids`, type: "tmdb" },
			"background",
		)
		if (externalIds?.error) return { rating: null, transient: true }
		if (!externalIds?.imdb_id) return { rating: null, transient }
		const imdb: ExternalResult = await sendMessage("imdbRating", { imdbId: externalIds.imdb_id }, "background")
		if (isLookupError(imdb)) return { rating: null, transient: true }
		return { rating: imdb, transient }
	} catch (error) {
		logLookupFailure("getExternalRating failed", error, tmdbId, media_type)
		return { rating: null, transient: true }
	}
}

// The user's Letterboxd diary and watchlist (synced by the background every few hours)
let letterboxdProfile: LetterboxdProfile | null = null
const rowPresentation = new RowPresentation()
const rowCardData = new WeakMap<HTMLElement, MovieInfo>()
const rowCardTitles = new WeakMap<HTMLElement, string>()
const rowCardDecorations = new WeakMap<HTMLElement, HTMLElement[]>()
const netflixShowTitles = new NetflixShowTitles()
// redrawAll: drop every card badge so the next pass draws it again (after a setting that changes how badges look)
function refreshRowPresentation(redrawAll = false) {
	const stale = rowPresentation.prune((card) => {
		const retryAfter = rowCardData.get(card)?.retryAfter ?? Number.POSITIVE_INFINITY
		return (
			!redrawAll &&
			retryAfter > Date.now() &&
			getCleanTitle(card, card.dataset.cardTitle ? 0 : 1) === rowCardTitles.get(card)
		)
	})
	for (const card of stale) {
		rowCardDecorations.get(card)?.forEach((decoration) => decoration.remove())
		card.classList.remove("imdb")
		if (isPrimeVideo) card.closest("li")?.classList.remove("imdb")
		rowCardData.delete(card)
		searchSorting.forgetRating(card)
	}
	const enabled = isNetflix
		? settings.value.Netflix?.showRating
		: isPrimeVideo
			? settings.value.Amazon?.showRating
			: isHBO
				? settings.value.HBO?.showRating
				: false
	rowPresentation.refresh(
		{
			fadeWatched: !!enabled && settings.value.General.fadeWatched,
			hideBelow: !!enabled && settings.value.General.hideBelowRating,
		},
		(card) => {
			const data = rowCardData.get(card)
			const slug = data?.source === "letterboxd" ? getLetterboxdSlug(data.rating_url) : undefined
			return !!slug && letterboxdProfile?.watched[slug] !== undefined
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
watch(
	() => [
		settings.value.General.fadeWatched,
		settings.value.General.hideBelowRating,
		settings.value.General.dimBelowBand,
		settings.value.Netflix?.showRating,
		settings.value.Amazon?.showRating,
		settings.value.HBO?.showRating,
	],
	() => refreshRowPresentation(),
)
// badges read these when they're drawn, so redraw the ones on screen; settled first, as the glass slider fires per step
let badgeRedrawTimer: ReturnType<typeof setTimeout> | undefined
watch(
	() => [
		settings.value.General.ratingSources,
		settings.value.General.friendsRatings,
		settings.value.General.friendsStyle,
		settings.value.General.badgeStyle,
		settings.value.General.glassFrost,
		settings.value.General.markWatched,
	],
	() => {
		clearTimeout(badgeRedrawTimer)
		badgeRedrawTimer = setTimeout(() => refreshRowPresentation(true), 150)
	},
)
let watchlistSlugs = new Set<string>()

const searchSorting = new SearchRatingSort()
const creditsPrompt = new CreditsRatingPrompt(() => {
	Promise.resolve(sendMessage("openAccountSetup", {}, "background")).catch(() => {})
})
let playerLookup: {
	title: string
	sources: RatingSources
	data: FeatureRating | null
	pending?: Promise<unknown>
	retry: number
} | null = null
const episodeRatings = new EpisodeRatings(
	async (title, type, year) => {
		const cached = DBCache[title]
		if (
			isCacheCurrent(cached) &&
			(!type || cached.media_type === type) &&
			(!year || cached.release_date?.startsWith(year)) &&
			getDiffInDays(cached.date, new Date()) <= 1
		)
			return cached
		return lookupMovieInfo(title, type, year)
	},
	async (data: FeatureRating, season): Promise<EpisodeRating[]> => {
		let imdbId = data.rating_url?.match(/imdb\.com\/title\/(tt\d+)/)?.[1]
		if (!imdbId) {
			const result: { imdb_id?: string; error?: string } = await sendMessage(
				"fetch",
				{
					url: `https://api.themoviedb.org/3/tv/${data.id}/external_ids`,
					type: "tmdb",
				},
				"background",
			)
			imdbId = result?.imdb_id
		}
		if (!imdbId) throw new Error("IMDb series unavailable")
		const result = (await sendMessage("imdbEpisodes", { imdbId, season }, "background")) as
			EpisodeRating[] | { error: string }
		if (!Array.isArray(result)) throw new Error("Episode ratings unavailable")
		return result
	},
)

function featureSite(): FeatureSite {
	return isNetflix ? "netflix" : isHBO ? "hbo" : "prime"
}
function updateSearchSorting() {
	if (!settings.value.General.searchSort || !location.pathname.includes("search")) {
		searchSorting.clear()
		return
	}
	const grids = new Set<HTMLElement>()
	if (isNetflix)
		document
			.querySelectorAll<HTMLElement>('[data-uia="search-page"] section[data-uia="gallery"]')
			.forEach((grid) => grids.add(grid))
	else {
		// Find the actual grid/flex container instead of reordering a framework-owned list.
		const cards = document.querySelectorAll<HTMLElement>(
			isHBO ? 'a[data-testid$="_tile"]' : 'article[data-card-title], article[data-testid*="-card"]',
		)
		cards.forEach((card) => {
			for (let parent = card.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
				const display = getComputedStyle(parent).display
				if (
					(display === "grid" || display === "flex") &&
					Array.from(parent.children).filter(
						(child) =>
							child === card ||
							child.contains(card) ||
							child.querySelector(isHBO ? 'a[data-testid$="_tile"]' : "article"),
					).length > 1
				) {
					grids.add(parent)
					break
				}
			}
		})
	}
	if (!grids.size) {
		searchSorting.clear()
		return
	}
	grids.forEach((grid) => searchSorting.update(grid))
}
let pageFeaturesStarted = false
function startPageFeatures() {
	if (pageFeaturesStarted) return
	pageFeaturesStarted = true
	const tick = () => {
		if (document.hidden) return
		episodeRatings
			.tick(featureSite(), {
				episodes: settings.value.General.episodeRatings,
				sources: ratingSources(),
				glassFrost: settings.value.General.badgeStyle === "glass" ? settings.value.General.glassFrost : undefined,
			})
			.catch((error) => console.debug("streamBuddy page ratings:", error))
		updateSearchSorting()
		updateCreditsPrompt()
	}
	setInterval(tick, 1000)
	watch(
		() => [
			settings.value.General.episodeRatings,
			settings.value.General.searchSort,
			settings.value.General.rateOnCredits,
		],
		tick,
	)
	tick()
}

// the review pill, once up, stays put until it's dismissed or you're a couple of minutes into something else:
// Netflix swaps the film for a trailer about 10 seconds into its end screen and then leaves the player, and Prime
// autoplays the next film in the same video and moves to its page
let creditsShownFor: number | null = null
// Netflix's metadata for the title playing, which marks when its credits start
let netflixPlaying: { id: string; credits?: NetflixCredits | null } | null = null
function updateCreditsPrompt() {
	const enabled = settings.value.General.rateOnCredits
	if (!enabled) {
		creditsPrompt.tick(null, null, false)
		return
	}
	const video = filmVideo()
	const watchingSomethingElse =
		!!video && video.duration !== creditsShownFor && video.currentTime > 2 * 60 && !video.paused
	if (creditsPrompt.showing && creditsShownFor !== null && !watchingSomethingElse) {
		placeCreditsReview()
		return
	}
	creditsShownFor = null
	if (!isOnPlayerPage()) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const netflix = isNetflix ? netflixCredits() : undefined
	// how long Netflix says the credits run, when it does
	const marked = video && netflix?.creditsShare ? netflix.creditsShare * video.duration : undefined
	// look the film up a couple of minutes before its credits, so it's ready when they start
	if (!video || !inCredits(video, (marked ?? creditsLength(video.duration)) + 2 * 60)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	// films, and the last episode of a limited series; never the rest of a show
	const episode = playingEpisode(netflix)
	if (episode === null) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const raw = episode
		? episode.show
		: isNetflix
			? (netflix?.title ?? document.querySelector('[data-uia="video-title"] h4')?.textContent)
			: document.title
	const title = raw
		?.replace(/^Prime Video:\s*/i, "")
		.split(/\s*[•·|]\s*/)[0]
		?.trim()
	if (!title || /^(Netflix|Prime Video|HBO\s*Max)$/i.test(title)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const key = episode ? `${title}|S${episode.season}E${episode.episode}` : title
	if (playerLookup?.title !== key || playerLookup.sources !== ratingSources())
		playerLookup = { title: key, sources: ratingSources(), data: null, retry: 0 }
	// a rating whose friends' scores failed to load is shown meanwhile and looked up again once it's due a retry
	const due = (playerLookup.data as { retryAfter?: number } | null)?.retryAfter ?? Number.POSITIVE_INFINITY
	if (!playerLookup.pending && (!playerLookup.data || due <= Date.now()) && playerLookup.retry <= Date.now()) {
		const current = playerLookup
		current.pending = (episode ? lookupSeriesFinale({ ...episode, show: title }) : lookupMovieInfo(title, null, null))
			.then((data) => {
				current.data = data ?? current.data
			})
			.catch(() => {})
			.finally(() => {
				current.pending = undefined
				current.retry = Date.now() + 30_000
			})
	}
	const slug = playerLookup.data?.source === "letterboxd" ? getLetterboxdSlug(playerLookup.data.rating_url) : undefined
	// the services' own end screens come up when the credits start, even without a marker in Netflix's metadata;
	// Prime's next-up row comes up within seconds of the end credits it marks in its own playback data
	const endScreen = isNetflix
		? !!document.querySelector('[data-uia="postplay-player-space"]')
		: isPrimeVideo && video.duration - video.currentTime < 15 * 60 && !!document.querySelector("[class*=nextupcard]")
	creditsPrompt.tick(
		video,
		playerLookup.data,
		true,
		{
			username: letterboxdUsername,
			watched: slug && letterboxdProfile?.username === letterboxdUsername ? letterboxdProfile.watched[slug] : undefined,
			friends: settings.value.General.friendsRatings,
		},
		endScreen ? video.duration : marked,
	)
	if (creditsPrompt.showing) {
		creditsShownFor = video.duration
		placeCreditsReview()
	}
}
// the episode playing, if it's one: undefined for a film, null for an episode that isn't a limited series' finale
// (or one that can't be placed in its show)
function playingEpisode(netflix: NetflixCredits | undefined): PlayingEpisode | null | undefined {
	if (netflix && !netflix.movie) {
		const episode = netflix.episode
		return episode?.last ? { show: netflix.title, season: episode.season, episode: episode.number } : null
	}
	if (isNetflix) return undefined
	const text = (selector: string) => document.querySelector(selector)?.textContent?.trim()
	// as the playback adapters read them: Prime's newer players label the episode in episode-info, and Max's
	// player can be missing its show title
	const place = parseEpisodeLabel(
		isHBO
			? text('[data-testid="player-ux-season-episode"]')
			: text(".atvwebplayersdk-episode-info") || text(".atvwebplayersdk-subtitle-text"),
	)
	const show = (isHBO ? hbo : prime).showTitle()
	if (place && show) return { show, ...place }
	if (
		document.querySelector('[data-testid="player-ux-season-episode"]') ||
		/(?:S\d+\s*:?\s*E\d+|Season\s+\d+|Episode\s+\d+)/i.test(document.title)
	)
		return null
	return undefined
}
// a show's last episode gets the pill when Letterboxd has a page for the show, which it only has for limited series.
// TMDb's episode counts decide, even on Netflix, which marks the newest episode of a weekly release as its last.
const finaleLookups = new Map<string, Promise<MovieInfo | null>>()
function lookupSeriesFinale(episode: PlayingEpisode): Promise<MovieInfo | null> {
	const key = `${episode.show}|S${episode.season}E${episode.episode}|${settings.value.General.friendsRatings}`
	return shareLookup(finaleLookups, key, () => findSeriesFinale(episode)).then((found) => {
		// friends' ratings failed for a moment: let the retry after retryAfter ask again rather than reuse this
		if (found?.retryAfter) finaleLookups.delete(key)
		return found
	})
}
async function findSeriesFinale({ show, season, episode }: PlayingEpisode): Promise<MovieInfo | null> {
	const locale = htmlLang || navigator?.language || "en-US"
	const search: TMDBResponse & { error?: string } = await sendMessage(
		"fetch",
		{
			url: `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(show)}&include_adult=false&language=${locale}&page=1`,
			type: "tmdb",
		},
		"background",
	)
	if (!search || search.error) return null
	const match = pickBestMatch(search.results, show)
	if (!match?.id) return null
	const details: {
		seasons?: Array<{ season_number?: number; episode_count?: number }>
		external_ids?: { imdb_id?: string | null }
		error?: string
	} = await sendMessage(
		"fetch",
		{ url: `https://api.themoviedb.org/3/tv/${match.id}?append_to_response=external_ids`, type: "tmdb" },
		"background",
	)
	if (!details || details.error || !isLastEpisode(details.seasons, season, episode)) return null
	const imdbId = details.external_ids?.imdb_id
	if (!imdbId) return null
	const letterboxd: ExternalResult = await sendMessage(
		"letterboxdSeries",
		{ imdbId, friends: settings.value.General.friendsRatings },
		"background",
	)
	if (!letterboxd || isLookupError(letterboxd)) return null
	return {
		id: match.id,
		media_type: "tv",
		title: match.name || match.original_name || show,
		score: match.vote_average,
		vote_count: match.vote_count,
		release_date: match.first_air_date,
		poster_path: match.poster_path ?? null,
		date: today,
		db: "tmdb",
		source: letterboxd.source,
		rating: letterboxd.rating,
		rating_count: letterboxd.rating_count,
		rating_url: letterboxd.url,
		friends_rating: letterboxd.friends_rating,
		friends_count: letterboxd.friends_count,
		friends: letterboxd.friends,
		retryAfter: letterboxd.friends_unavailable ? Date.now() + 30_000 : undefined,
	}
}
// the longest video on the page is the film: Prime keeps its detail page's trailer underneath the player
function filmVideo() {
	let film: HTMLVideoElement | null = null
	for (const video of Array.from(document.querySelectorAll("video")))
		if (Number.isFinite(video.duration) && (!film || video.duration > film.duration)) film = video
	return film
}
// clear of each service's own end-of-film UI: Netflix previews the next title bottom right, so the pill lines up
// with its back arrow bottom left; Prime's next-up row fills the bottom, so it goes top right
function placeCreditsReview() {
	const review = document.querySelector<HTMLElement>(".sb-review")
	if (!review) return
	if (isNetflix) {
		review.classList.add("sb-review-left")
		const back = document.querySelector('[data-uia="control-nav-back"]')?.getBoundingClientRect()
		if (back?.width) review.style.setProperty("--sb-review-left", `${Math.round(back.left)}px`)
	} else if (isPrimeVideo) review.classList.add("sb-review-top")
}
// what Netflix's metadata says about the title on /watch/{id}, once it has loaded
function netflixCredits() {
	const id = location.pathname.match(/^\/watch\/(\d+)/)?.[1]
	if (!id) return undefined
	if (netflixPlaying?.id !== id) {
		const playing: NonNullable<typeof netflixPlaying> = { id }
		netflixPlaying = playing
		fetchNetflixMetadata(id).then((json) => {
			playing.credits = parseNetflixCredits(json)
		})
	}
	return netflixPlaying.credits ?? undefined
}
function setLetterboxdProfile(profile: LetterboxdProfile | null) {
	letterboxdProfile = profile
	watchlistSlugs = new Set(profile?.watchlist)
	refreshRowPresentation()
}
// entered during onboarding; read once at startup and kept current if the user changes it
let letterboxdUsername = ""
let accountWatched = false
async function loadLetterboxdProfile() {
	letterboxdUsername = (await getAccount()).letterboxdUsername
	if (!accountWatched) {
		accountWatched = true
		onAccountChanged((account) => {
			if (account.letterboxdUsername === letterboxdUsername) return
			setLetterboxdProfile(null)
			loadLetterboxdProfile()
		})
		browser.storage.onChanged.addListener((changes, areaName) => {
			const profile = changes.letterboxdProfile?.newValue as LetterboxdProfile | undefined
			if (areaName === "local" && profile?.username === letterboxdUsername) setLetterboxdProfile(profile)
		})
	}
	if (!letterboxdUsername) return
	Promise.resolve(sendMessage("letterboxdProfile", {}, "background"))
		.then((profile) => {
			if (profile && !("error" in (profile as object))) setLetterboxdProfile(profile as LetterboxdProfile)
		})
		.catch(() => {})
}
function getPersonalStatus(data: MovieInfo): { watched?: number; watchlist: boolean } {
	const slug = data.source === "letterboxd" ? getLetterboxdSlug(data.rating_url) : undefined
	if (!slug || !letterboxdProfile || !settings.value.General.markWatched) return { watchlist: false }
	return { watched: letterboxdProfile.watched[slug], watchlist: watchlistSlugs.has(slug) }
}

// which service the tab is on, and whether its card ratings are switched on
function currentService(): StreamingService | null {
	return isNetflix ? "Netflix" : isPrimeVideo ? "Amazon" : isHBO ? "HBO" : null
}
function ratingsEnabled() {
	const service = currentService()
	return !!service && settings.value[service].showRating
}
// Prime's detail pages also list extras and trailers; only rate the "related" tab there
function showRating() {
	if (isPrimeVideo && globalThis.location.href.includes("detail"))
		return document.querySelector('[data-testid="btf-related-tab"]')?.getAttribute("tabIndex") == "0"
	return true
}
async function startShowRatingInterval() {
	if (showRating()) addRating()
	// New cards get rated on the next frame after they appear instead of on the next 1s tick. Player pages mutate
	// constantly and have no cards, so they're ignored; the interval stays as a safety net and to stop when switched off.
	let stopped = false
	let tickScheduled = false
	const scheduleTick = () => {
		if (stopped || tickScheduled || document.hidden || isOnPlayerPage()) return
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
export function getDiffInDays(firstDate: string, secondDate: Date) {
	if (!firstDate || !secondDate) return 31
	return Math.round(Math.abs(new Date(secondDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24))
}

// DBCache logic
// 1. Condition No Cached Rating -> Fetch Rating
// 2. Condition No Rating but in Cache if cache older than 7 days -> Fetch Rating
// 3. Condition Cached Rating older than 30 days -> Fetch Rating
// 4. Condition Cached Rating older than 1 day, Vote count under 100 and Release date in the last 50 days -> Fetch Rating
// 5. Condition if media_type is not matching -> Fetch Rating
function useDBCache(title: string, card: HTMLElement, media_type: string | null) {
	if (!DBCache[title]?.date) DBCache[title].date = today
	const vote_count = DBCache[title]?.vote_count || 100
	const diffInReleaseDate =
		// vote count is under 80 inaccurate rating
		vote_count < 100 &&
		// did not refresh rating in the last 0 days
		getDiffInDays(DBCache[title].date, date) > 1 &&
		// release date is in the last 50 days after not many people will
		getDiffInDays(DBCache[title]?.release_date, date) <= 50

	// refresh rating if older than 30 days or release date is in last month and vote count is under 100
	if (getDiffInDays(DBCache[title].date, date) >= GCdiff || diffInReleaseDate) {
		if (diffInReleaseDate)
			debugLog(
				"update recent movie:",
				title,
				",refresh:",
				getDiffInDays(DBCache[title].date, date),
				",Age:",
				getDiffInDays(DBCache[title]?.release_date, date),
				"Vote count:",
				vote_count,
			)
		else debugLog("update old rating:", title, ",Age:", getDiffInDays(DBCache[title].date, date))
		getMovieInfo(title, card, media_type)
	} else {
		setRatingOnCard(card, DBCache[title], title)
	}
}
export type MediaType = "tv" | "movie" | null
function Amazon_getMediaType(type: string): MediaType {
	if (!type) return null
	if (type.toLowerCase().includes("tv")) return "tv"
	if (type.toLowerCase().includes("movie")) return "movie"
	return null
}
function getAllTitleCardsTypes(): Array<NodeListOf<Element>> {
	let AllTitleCardsTypes: Array<NodeListOf<Element>> = []
	if (isNetflix)
		AllTitleCardsTypes = [
			document.querySelectorAll(
				'a[data-uia="standard-card"]:not(.imdb), a[data-uia="progress-card"]:not(.imdb), a[data-uia="ranked-card"]:not(.imdb), a[data-uia="episodic-card"]:not(.imdb)',
			),
		]
	else if (isHBO) AllTitleCardsTypes = [document.querySelectorAll("a[class*='StyledTileLinkNormal-']:not(.imdb)")]
	else if (isPrimeVideo)
		AllTitleCardsTypes = [
			document.querySelectorAll(
				// rows hold their cards in li; the search grid's cards are listitems themselves (article[data-testid=card])
				":is(li article, article[data-testid='card'])[data-card-title]:not([data-card-entity-type='EVENT']):not([data-card-title='Live-TV']):not(:has(#rating))",
			),
			document.querySelectorAll("article[data-testid*='-card']:not(:has(#rating))"),
		]
	return AllTitleCardsTypes
}
// "Visible" includes one screen ahead (below, and to the right for rows), so the next row is usually rated
// before you scroll to it instead of starting its lookups only once it's on screen.
const LOOKAHEAD_SCREENS = 1
function isElementVisible(el: HTMLElement): boolean {
	if (!el) return false
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
	url = globalThis.location.href
	const AllTitleCardsTypes = getAllTitleCardsTypes()
	// a card can hold several images of the same title, so only use the first one
	let lastTitle = ""
	// for each is not going in order on chrome
	let updateDBCache = false
	for (let type = 0; type < AllTitleCardsTypes.length; type++) {
		const titleCards = AllTitleCardsTypes[type]
		for (let i = 0; i < titleCards.length; i++) {
			const card = titleCards[i] as HTMLElement
			// add seen class
			if (isNetflix || isHBO) card.classList.add("imdb")
			else if (isPrimeVideo) {
				if (type == 0) card?.closest("li")?.classList.add("imdb")
				else if (type == 1) card?.classList.add("imdb")
			}
			const media_type = getMediaType(card)
			const title = getCleanTitle(card, type)
			if (!title) {
				// an episode card whose show is still being looked up gets another pass once it's known
				if (
					isNetflixEpisodeCard(card) &&
					netflixShowTitles.get(getEpisodeId(card.getAttribute("href")) ?? "") === undefined
				)
					card.classList.remove("imdb")
				continue
			}
			if (checkedCards.isChecked(card, checkedKey(title))) continue
			{
				// sometimes more than one image is loaded for the same title
				if (lastTitle != title && !title.includes("Netflix") && !title.includes("Prime Video")) {
					lastTitle = title
					if (
						isCacheCurrent(DBCache[title]) &&
						// a Letterboxd/IMDb rating counts even when TMDb has no votes; unrated titles are retried after a week
						(DBCache[title]?.rating || DBCache[title]?.score || getDiffInDays(DBCache[title]?.date, date) <= 7) &&
						(!media_type || DBCache[title]?.media_type == media_type)
					) {
						useDBCache(title, card, media_type)
					}
					// if element is not visible skip it
					else if (!isElementVisible(card)) {
						if (isNetflix || isHBO) card.classList.remove("imdb")
						else if (isPrimeVideo) {
							if (type == 0) card?.closest("li")?.classList.remove("imdb")
							else if (type == 1) card?.classList.remove("imdb")
						}
						continue
					} else {
						getMovieInfo(title, card, media_type)
						updateDBCache = true
					}
				}
			}
		}
	}
	if (updateDBCache) scheduleCacheSave()
}
function getMediaType(card: HTMLElement): MediaType {
	let media_type: MediaType = null
	if (isNetflix) {
		if (isNetflixEpisodeCard(card) || url.includes("genre/83")) media_type = "tv"
		else if (url.includes("genre/34399")) media_type = "movie"
	} else if (isHBO) {
		const href = card.getAttribute("href") || ""
		if (href.includes("show") || href.includes("series")) media_type = "tv"
		else if (href.includes("movie")) media_type = "movie"
	} else if (isPrimeVideo) {
		if (url.includes("video/tv")) media_type = "tv"
		else if (url.includes("video/movie")) media_type = "movie"
		else media_type = Amazon_getMediaType(card.dataset.cardEntityType ?? "")
	}
	return media_type
}

// labelled with the episode name, so the series title is looked up (see netflix-shows.ts)
function isNetflixEpisodeCard(card: HTMLElement) {
	return card.dataset.uia === "episodic-card"
}
function getCleanTitle(card: HTMLElement, type: number): string | undefined {
	let title: string | undefined
	if (isNetflix) {
		if (isNetflixEpisodeCard(card)) {
			const episodeId = getEpisodeId(card.getAttribute("href"))
			return (episodeId && netflixShowTitles.get(episodeId)) || undefined
		}
		title = card?.getAttribute("aria-label")?.split(" (")[0]
	} else if (isPrimeVideo) {
		// detail means not live shows
		const link = Amazon_titleLink(card)
		if (link) {
			if (type == 0) title = Amazon_fixTitle(card.dataset.cardTitle ?? "")
			else if (type == 1) title = Amazon_fixTitle(link.getAttribute("aria-label") ?? "")
		}
		if (title && isSeasonOnlyTitle(title)) title = undefined
	} else if (isHBO) {
		const href = card.getAttribute("href") || ""
		if (
			href.includes("show") ||
			href.includes("series") ||
			href.includes("movie") ||
			href.includes("topical") ||
			href.includes("standalone")
		) {
			title =
				HBO_fixTitle(card.getAttribute("aria-label")) ?? card.querySelector("p[class*='md_strong-']")?.textContent ?? ""
		}
	}
	return title
}
export function HBO_fixTitle(label: string | null | undefined): string | undefined {
	if (!label) return undefined
	const firstPart = label.includes("\u2069") ? label.slice(0, label.indexOf("\u2069")) : label
	const title = firstPart.replaceAll(/[\u2066-\u2069\u200e\u200f]/g, "").trim()
	return title || undefined
}
// The card's own link to its title page. Not simply its first link: the badge is a link too, and once Prime re-renders a
// card (the large cards do on hover) the badge can come first, which read as the card having no title and dropped it.
export function Amazon_titleLink(card: HTMLElement) {
	const link = card.querySelector<HTMLAnchorElement>("a:not(.sb-card-rating)")
	return link?.href?.includes("detail") ? link : undefined
}
function Amazon_fixTitle(title: string | undefined) {
	return (
		title
			?.split(" - ")[0]
			?.split(" – ")[0]
			?.replaceAll(/(S\d+)/g, "")
			?.replaceAll(/ \[.*\]/g, "")
			?.replaceAll(/\s\(.*\)/g, "")
			?.replaceAll(/:?\sStaffel-?\s\d+/g, "")
			?.replaceAll(/:?\sSeason-?\s\d+/g, "")
			?.replaceAll(/ \/ \d/g, "")
			?.split(": Die komplette")[0]
			// nicht sicher
			?.split(": The complete")[0]
	)
}

// TMDb is only the fallback: colour it on the IMDb scale (both are out of 10), grey when too few people voted
const TMDB_LOW_RATING = 5.5
function getTmdbColor(rating: number, lowVoteCount: boolean) {
	return !rating || lowVoteCount ? color.badgeUnrated : getScoreColor("imdb", rating)
}
// Letterboxd and IMDb dim by colour band (the cut-off is picked in the popup); TMDb keeps the old threshold
function isDimmed(data: MovieInfo, lowVoteCount: boolean) {
	if (!settings.value.Video?.dimLowRatings) return false
	if (data?.source !== "tmdb" && data?.rating)
		return getScoreBand(data.source, data.rating) < settings.value.General.dimBelowBand
	return !lowVoteCount && (!data?.score || data.score <= TMDB_LOW_RATING)
}
function getTMDBUrl(id: string | number, media_type: string) {
	return `https://www.themoviedb.org/${media_type}/${id}`
}
// on a 0-10 scale so the dim-low-ratings thresholds work for every source
function getNormalizedScore(data: MovieInfo) {
	if (data?.source !== "tmdb" && data.rating) return normalizeRowScore(data.source, data.rating)
	return data?.score
}
function getRatingVoteCount(data: MovieInfo) {
	return (data?.source === "tmdb" ? data?.vote_count : data?.rating_count) || 0
}
// A popcorn chip: the score in a pill coloured by how it ranks among what's streaming, then, smaller, friends'
// Letterboxd average and your own status (your rating, seen, or on your watchlist), labelled or as dots per the
// friendsStyle setting. The exact score and scale are in the tooltip; colour adds context rather than carrying the meaning.
// colours inside the badge go through variables so the Liquid Glass look can switch them to light-on-glass
const BADGE_LABEL = `var(--sb-badge-label, ${color.badgeLabel})`
const BADGE_TEXT = `var(--sb-badge-ink, ${color.badgeInk})`
const BADGE_WATCHLIST = `var(--sb-badge-watchlist, ${color.badgeWatchlist})`
const BADGE_CHIP = `var(--sb-badge-bg, ${color.badgeBg})`
// the small column beside the score: friends/you lines, or the IMDb/TMDb source name
const LABEL_COLUMN_STYLE = { padding: "0 0.5em 0 0.45em", fontSize: "max(10px, 0.72em)", fontWeight: "800" }
function addBadgeSegment(div: HTMLElement, text: string, color = BADGE_TEXT) {
	const segment = document.createElement("span")
	Object.assign(segment.style, {
		display: "inline-flex",
		alignItems: "center",
		gap: "0.3em",
		padding: "0 0.5em 0 0.2em",
		fontSize: "max(11px, 0.8em)",
		fontWeight: "700",
		color,
		whiteSpace: "nowrap",
	})
	segment.append(text)
	div.appendChild(segment)
	return segment
}
// a little stack of faces: one per friend, coloured by name so the same friend keeps the same colour
function friendDots(colors: string[]) {
	const dots = document.createElement("span")
	dots.style.display = "inline-flex"
	colors.forEach((color, i) => {
		const dot = document.createElement("i")
		Object.assign(dot.style, {
			display: "block",
			width: "1.05em",
			height: "1.05em",
			boxSizing: "border-box",
			marginLeft: i ? "-0.35em" : "0",
			borderRadius: "50%",
			border: `0.15em solid ${BADGE_CHIP}`,
			background: color,
		})
		dots.appendChild(dot)
	})
	return dots
}
function friendColors(friends: { name: string }[], count: number) {
	const names = friends.length ? friends.map((friend) => friend.name) : Array.from({ length: count }, (_, i) => `${i}`)
	return names.slice(0, 3).map((name) => {
		const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
		return FRIEND_DOT_COLORS[hash % FRIEND_DOT_COLORS.length]
	})
}
function friendsIcon(friends: { name: string }[], count: number) {
	if (settings.value.General.friendsStyle === "trio") return friendDots(FRIEND_DOT_COLORS.slice(0, 3))
	return friendDots(friendColors(friends, count))
}
// The default layout: a small column beside the score with a labelled line each for friends and you,
// so what each number means is written on the badge rather than left to the tooltip.
function addLabelLine(
	div: HTMLElement,
	column: HTMLElement | undefined,
	dot: string,
	label: string,
	value: string,
	color = BADGE_TEXT,
) {
	if (!column) {
		column = document.createElement("span")
		Object.assign(column.style, {
			...LABEL_COLUMN_STYLE,
			display: "inline-flex",
			flexDirection: "column",
			gap: "0.2em",
			lineHeight: "1",
			whiteSpace: "nowrap",
		})
		div.appendChild(column)
	}
	const line = document.createElement("span")
	Object.assign(line.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5em" })
	const name = document.createElement("span")
	Object.assign(name.style, {
		display: "inline-flex",
		alignItems: "center",
		gap: "0.3em",
		color: BADGE_LABEL,
		fontWeight: "700",
	})
	const swatch = document.createElement("i")
	Object.assign(swatch.style, {
		display: "block",
		width: "0.6em",
		height: "0.6em",
		borderRadius: "50%",
		background: dot,
	})
	name.append(swatch, label)
	const score = document.createElement("span")
	score.style.color = color
	score.append(value)
	line.append(name, score)
	column.appendChild(line)
	return column
}
const formatCount = (count = 0) =>
	count >= 1e6 ? `${(count / 1e6).toFixed(1)}M` : count >= 1e3 ? `${Math.round(count / 1e3)}K` : String(count)
function fillBadge(div: HTMLElement, data: MovieInfo, prefix: string, tmdbColor: string | undefined) {
	const main = document.createElement("span")
	Object.assign(main.style, {
		padding: "0.28em 0.6em",
		borderRadius: "var(--sb-pill-r, 999px)",
		fontSize: "1.15em",
		fontWeight: "800",
		letterSpacing: "-0.02em",
		whiteSpace: "nowrap",
		// dark on the band colour in both badge looks
		color: color.badgeInk,
		textShadow: "none",
	})
	const tooltip: string[] = []
	let value: string
	if (data.source === "letterboxd") {
		value = data.rating?.toFixed(1) ?? ""
		main.style.background = getScoreColor("letterboxd", data.rating ?? 0)
		tooltip.push(`Letterboxd ${data.rating?.toFixed(2)}/5 · ${formatCount(data.rating_count)} ratings`)
	} else if (data.source === "imdb") {
		value = data.rating?.toFixed(1) ?? ""
		main.style.background = getScoreColor("imdb", data.rating ?? 0)
		tooltip.push(`IMDb ${data.rating?.toFixed(1)}/10 · ${formatCount(data.rating_count)} ratings`)
	} else {
		value = data.score?.toFixed(1) ?? ""
		main.style.background = tmdbColor ?? color.badgeUnrated
		tooltip.push(`TMDb ${data.score?.toFixed(1)}/10 (no Letterboxd or IMDb rating)`)
	}
	main.append(prefix + value)
	div.appendChild(main)
	// Letterboxd's 0-5 is the default; a 0-10 score from IMDb or TMDb says where it's from in the label column
	if (data.source !== "letterboxd") {
		const source = document.createElement("span")
		Object.assign(source.style, { ...LABEL_COLUMN_STYLE, color: BADGE_LABEL })
		source.append(data.source === "imdb" ? "IMDb" : "TMDb")
		div.appendChild(source)
	}
	const labelled = settings.value.General.friendsStyle === "labels"
	let column: HTMLElement | undefined
	if (data.source === "letterboxd" && data.friends_rating && settings.value.General.friendsRatings) {
		if (labelled) column = addLabelLine(div, column, color.accent, "friends", data.friends_rating.toFixed(1))
		else {
			const segment = addBadgeSegment(div, data.friends_rating.toFixed(1))
			segment.prepend(friendsIcon(data.friends ?? [], data.friends_count ?? 1))
		}
		const names = (data.friends ?? []).map((friend) => `${friend.name} ${friend.rating.toFixed(1)}`).join(", ")
		tooltip.push(
			`Friends ${data.friends_rating.toFixed(1)} from ${data.friends_count}${names ? `: ${names}` : ""}${(data.friends_count ?? 0) > (data.friends?.length ?? 0) ? "…" : ""}`,
		)
	}
	const personal = getPersonalStatus(data)
	if (personal.watched !== undefined) {
		if (labelled) addLabelLine(div, column, color.info, "you", personal.watched ? personal.watched.toFixed(1) : "seen")
		else addBadgeSegment(div, personal.watched ? `✓ you ${personal.watched.toFixed(1)}` : "✓ seen")
		tooltip.push(personal.watched ? `You rated it ${personal.watched.toFixed(1)}` : "You've logged it")
	} else if (personal.watchlist) {
		if (labelled) addLabelLine(div, column, color.info, "you", "watchlist", BADGE_WATCHLIST)
		else addBadgeSegment(div, "watchlist", BADGE_WATCHLIST)
		tooltip.push("On your watchlist")
	}
	div.title = tooltip.join("\n")
	div.setAttribute("aria-label", tooltip.join(". "))
}

// The badge sits in a corner of the card's artwork: the same gap from both edges of that corner, and its corners
// follow the artwork's (the artwork's radius less the gap, and the score pill inside the same again, so the curves
// share a centre). The artwork often sits inset in the element the badge is attached to (Netflix pads its slots,
// Max its tiles), so the gap is measured from the artwork itself rather than from the badge's container.
const BADGE_INSET_PX = 3
const BADGE_PAD_PX = 3
type BadgeCorner = "top" | "bottom"
const badgeFits = new WeakMap<HTMLElement, { host: HTMLElement; corner: BadgeCorner; raise: number }>()
// the artwork: the biggest rounded box in the card (else its biggest image), skipping our own badge and overlays.
// The container itself is only a fallback, since its box includes the gutter around the artwork.
function findArtwork(host: HTMLElement) {
	const rounded: { el: HTMLElement; rect: DOMRect }[] = []
	let image: { el: HTMLElement; rect: DOMRect } | undefined
	const area = (rect: DOMRect) => rect.width * rect.height
	for (const el of Array.from(host.querySelectorAll<HTMLElement>("img, picture, div, span")).slice(0, 80)) {
		if (el.closest(".sb-card-rating")) continue
		const rect = el.getBoundingClientRect()
		if (!rect.width || !rect.height) continue
		const style = getComputedStyle(el)
		const radius =
			Number.parseFloat(style.borderTopRightRadius) || Number.parseFloat(style.borderBottomRightRadius) || 0
		if (radius > 0 && style.borderTopRightRadius.endsWith("px")) rounded.push({ el, rect })
		if (el.tagName === "IMG" && (!image || area(rect) > area(image.rect))) image = { el, rect }
	}
	// a rounded badge or progress bar is no artwork, so the rounded box has to be about as big as the biggest image,
	// and a focus ring drawn around the image (Max's tile outline) isn't either, so it can't reach outside it
	const inside = (rect: DOMRect, outer: DOMRect) =>
		rect.left >= outer.left - 0.5 &&
		rect.top >= outer.top - 0.5 &&
		rect.right <= outer.right + 0.5 &&
		rect.bottom <= outer.bottom + 0.5
	const artwork = rounded
		.filter(({ rect }) => !image || (area(rect) >= area(image.rect) * 0.8 && inside(rect, image.rect)))
		.sort((a, b) => area(b.rect) - area(a.rect))[0]
	return artwork ?? image ?? { el: host, rect: host.getBoundingClientRect() }
}
function cornerRadius(art: HTMLElement, host: HTMLElement, corner: BadgeCorner) {
	const property = corner === "top" ? "borderTopRightRadius" : "borderBottomRightRadius"
	// the radius can sit on the artwork or on a clipping ancestor of it inside the card
	let radius = 0
	for (let el: HTMLElement | null = art; el; el = el === host ? null : el.parentElement) {
		const value = getComputedStyle(el)[property]
		if (value.endsWith("px")) radius = Math.max(radius, Number.parseFloat(value) || 0)
	}
	return radius
}
// raise: a bottom badge sits that fraction of the artwork's height higher (Prime's channel logo)
function fitBadgeToCorner(div: HTMLElement, host: HTMLElement, corner: BadgeCorner, raise = 0) {
	badgeFits.set(div, { host, corner, raise })
	watchBadgeResizes()
	const art = findArtwork(host)
	const box = div.offsetParent as HTMLElement | null
	if (art && box) {
		const outer = box.getBoundingClientRect()
		const border = getComputedStyle(box)
		// absolute offsets are measured from the containing block's padding box; clientWidth and clientHeight round
		// to whole pixels, so take its edges from the fractional rect instead
		const px = (value: number) => `${value.toFixed(2)}px`
		const right = outer.right - Number.parseFloat(border.borderRightWidth)
		div.style.right = px(right - art.rect.right + BADGE_INSET_PX)
		if (corner === "top")
			div.style.top = px(art.rect.top - (outer.top + Number.parseFloat(border.borderTopWidth)) + BADGE_INSET_PX)
		else {
			const bottom = outer.bottom - Number.parseFloat(border.borderBottomWidth)
			div.style.bottom = px(bottom - art.rect.bottom + art.rect.height * raise + BADGE_INSET_PX)
		}
	}
	const radius = art ? cornerRadius(art.el, host, corner) : 0
	const badgeRadius = Math.max(radius - BADGE_INSET_PX, 2)
	div.style.borderRadius = `${badgeRadius}px`
	div.style.setProperty("--sb-pill-r", `${Math.max(badgeRadius - BADGE_PAD_PX, 2)}px`)
}
// card sizes follow the window, so re-measure the badges on screen after a resize settles
let badgeResizeTimer: ReturnType<typeof setTimeout> | undefined
let watchingBadgeResizes = false
function watchBadgeResizes() {
	if (watchingBadgeResizes) return
	watchingBadgeResizes = true
	globalThis.addEventListener("resize", () => {
		clearTimeout(badgeResizeTimer)
		badgeResizeTimer = setTimeout(() => {
			for (const div of Array.from(document.querySelectorAll<HTMLElement>(".sb-card-rating"))) {
				const fit = badgeFits.get(div)
				if (fit && div.isConnected) fitBadgeToCorner(div, fit.host, fit.corner, fit.raise)
			}
		}, 200)
	})
}

// Prime composites its own "prime" or channel logo into the artwork's bottom-right corner, and the image URL
// says where: _CLs|W,H|...channels-logo...|...+x,y,w,h. Returns how far up the card the logo reaches (0 when none).
// Read it off the image on show: the large cards also hold a hidden landscape image with its logo elsewhere.
function primeLogoHeight(container: HTMLElement) {
	const area = (el: Element) => el.getBoundingClientRect().width * el.getBoundingClientRect().height
	const img = Array.from(container.querySelectorAll("img")).reduce<HTMLImageElement | null>(
		(best, el) => (!best || area(el) > area(best) ? el : best),
		null,
	)
	if (!img) return 0
	const src = decodeURIComponent(img.currentSrc || img.src || img.srcset)
	const match = /_CLs\|\d+,(\d+)\|[^|]*channels-logo[^|]*\|(?:\d+,\d+,\d+,\d+\+)*\d+,(\d+),\d+,\d+/.exec(src)
	if (!match) return 0
	const height = Number(match[1])
	return (height - Number(match[2])) / height
}

async function setRatingOnCard(card: HTMLElement, data: MovieInfo, title: string) {
	if (!card.isConnected) return
	if ((isNetflix || isHBO || isPrimeVideo) && getCleanTitle(card, card.dataset.cardTitle ? 0 : 1) !== title) {
		card.classList.remove("imdb")
		card.closest("li")?.classList.remove("imdb")
		return
	}
	// a card picked up again while its lookup was in flight waits on the same lookup; draw its badge only once
	if (rowCardTitles.get(card) === title && rowCardDecorations.get(card)?.[0]?.isConnected) return
	let div: HTMLElement
	if (data?.id) {
		{
			const a = document.createElement("a")
			a.href = data.rating_url ?? getTMDBUrl(data.id, data.media_type)
			a.target = "_blank"
			a.rel = "noopener noreferrer"
			a.addEventListener("click", (event) => event.stopPropagation())
			div = a
		}
	} else div = document.createElement("div")
	// nothing to say about this title: show nothing rather than a "?" or a meaningless 0.0
	const hasRating = (data?.source !== "tmdb" && !!data?.rating) || data?.score > 0
	if (!hasRating) {
		debugLog("no score found:", title, data, card)
		// Prime's card selectors can't skip cards already seen, so remember it. A cached unrated title is looked up
		// again once the cache refreshes it (a week), which needs a page load anyway; a result left uncached because
		// Letterboxd/IMDb failed for a moment is retried shortly
		checkedCards.mark(card, checkedKey(title), DBCache[title] === data ? Number.POSITIVE_INFINITY : Date.now() + 30_000)
		return
	}
	const vote_count = getRatingVoteCount(data)
	const score = getNormalizedScore(data)
	// right: 1.5vw;
	installPageFeatureStyle()
	div.id = "rating"
	div.classList.add("sb-card-rating")
	// which streamBuddy build drew this badge (handy for checking that a rebuild was picked up)
	div.dataset.sbBuild = __BUILD_ID__
	const zIndexValue = isPrimeVideo ? "3" : "2"
	// popcorn chip: score pill first, friends and your status beside it; wraps on narrow cards
	Object.assign(div.style, {
		position: "absolute",
		// Netflix draws its "Recently added" and "Leaving soon" tags into the bottom of the boxart; the top-right is clear
		...(isNetflix ? { top: `${BADGE_INSET_PX}px` } : { bottom: `${BADGE_INSET_PX}px` }),
		right: isNetflix ? `calc(0.2vw + ${BADGE_INSET_PX}px)` : `${BADGE_INSET_PX}px`,
		maxWidth: `calc(100% - ${2 * BADGE_INSET_PX}px)`,
		boxSizing: "border-box",
		display: "flex",
		flexWrap: "wrap",
		justifyContent: "flex-end",
		alignItems: "center",
		rowGap: "0.2em",
		color: BADGE_TEXT,
		textDecoration: "none",
		background: BADGE_CHIP,
		boxShadow: shadow.sticker,
		borderRadius: "1.1em",
		opacity: "0",
		transform: "translateY(2px)",
		transition: `opacity 160ms ease-out, transform 220ms ${ease.settle}`,
		padding: `${BADGE_PAD_PX}px`,
		fontFamily: font.page,
		fontWeight: "700",
		fontVariantNumeric: "tabular-nums",
		lineHeight: "1",
		zIndex: zIndexValue,
		fontSize: isMobile ? "clamp(13px, 4vw, 19px)" : "clamp(13px, 0.95vw, 17px)",
	})

	if (settings.value.General.badgeStyle === "glass") applyGlass(div, settings.value.General.glassFrost)
	requestAnimationFrame(() => Object.assign(div.style, { opacity: "1", transform: "none" }))
	{
		fillBadge(div, data, "", getTmdbColor(score, vote_count < 50))
		if (data.source !== "tmdb" && data.rating && activePlatform) {
			const personal = getPersonalStatus(data)
			queueSeenTitle(
				{
					title: data.title || title,
					source: data.source,
					rating: data.rating,
					url: data.rating_url ?? "",
					platform: activePlatform,
					media_type: data.media_type,
					seen: localDateKey(new Date()),
				},
				{ watched: personal.watched !== undefined, watchlist: personal.watchlist },
			)
		}
		div.setAttribute(
			"alt",
			"Filtered title: " +
				title +
				", Fetched title: " +
				data?.title +
				", media_type: " +
				data?.media_type +
				", source: " +
				data?.source +
				", Vote count: " +
				vote_count,
		)
	}
	const greyOverlay = document.createElement("div")
	Object.assign(greyOverlay.style, {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		background: color.dimOverlay,
		pointerEvents: "none" /* allows clicks to pass through */,
		zIndex: 2,
	})
	if (isNetflix) {
		const titleCardContainer = (card.closest("div[data-virtual-slot]") ?? card.parentElement) as HTMLElement
		if (titleCardContainer) {
			if (getComputedStyle(titleCardContainer).position === "static") titleCardContainer.style.position = "relative"
			titleCardContainer.appendChild(div)
			fitBadgeToCorner(div, titleCardContainer, "top")
			if (isDimmed(data, vote_count < 50)) titleCardContainer.appendChild(greyOverlay)
			// titleCardContainer.style.opacity = getTransparencyForRating(data?.score, vote_count < 50)
		}
	} else if (isHBO) {
		// the tile link itself is unpositioned; the poster container is the relative box
		const position = (card.querySelector('[data-testid$="_tileImage"]') as HTMLElement | null) ?? card
		position.appendChild(div)
		fitBadgeToCorner(div, position, "bottom")
		if (isDimmed(data, vote_count < 50)) position.appendChild(greyOverlay)
		// card.style.opacity = getTransparencyForRating(data?.score, vote_count < 50)
	} else if (isPrimeVideo) {
		let position: HTMLElement = card
		// the hero's metadata block has no artwork, only the title's logo image, which the badge mustn't cover
		const heroMetadata = card.dataset.cardTitle
			? null
			: card.querySelector<HTMLElement>('div[data-testid="title-metadata-main"]')
		if (card.dataset.cardTitle) position = card?.firstChild?.firstChild as HTMLElement
		else if (heroMetadata) position = heroMetadata
		const logoHeight = position && !heroMetadata ? primeLogoHeight(position) : 0
		if (logoHeight) div.style.bottom = `calc(${(logoHeight * 100).toFixed(1)}% + ${BADGE_INSET_PX}px)`
		if (position) {
			position.appendChild(div)
			if (!heroMetadata) fitBadgeToCorner(div, position, "bottom", logoHeight)
		}
		if (isDimmed(data, vote_count < 50)) position?.appendChild(greyOverlay)
		// card.closest("li")?.style.setProperty("opacity", getTransparencyForRating(data?.score, vote_count < 50))
	}
	if (div.isConnected && (isNetflix || isHBO || isPrimeVideo)) {
		searchSorting.setRating(card, score)
		rowCardData.set(card, data)
		rowCardTitles.set(card, title)
		rowCardDecorations.set(card, [div, greyOverlay])
		const hideTarget = isNetflix
			? (card.closest<HTMLElement>("[data-virtual-slot]") ?? card.parentElement ?? card)
			: isPrimeVideo
				? (card.closest<HTMLElement>("li") ?? card)
				: card
		rowPresentation.track(card, hideTarget)
		refreshRowPresentation()
	}
}
// #region streamBuddy stats
// Watch time only counts on player pages while the video is actually advancing,
// so autoplaying previews on the browse pages and paused players don't add up.
const WATCH_TICK_SECONDS = 15
const watchState: WatchTimerState = { pendingSeconds: 0, lastVideoTime: -1 }
function isOnPlayerPage() {
	const path = globalThis.location.pathname
	if (isNetflix) return path.startsWith("/watch")
	// the same two player roots the playback engine looks for; newer players only have #dv-web-player
	if (isPrimeVideo) return !!document.querySelector(".dv-player-fullscreen video, #dv-web-player video")
	if (isHBO) return path.includes("/video/watch")
	return false
}
function getPlayingVideo() {
	let best: HTMLVideoElement | undefined
	for (const video of Array.from(document.querySelectorAll("video"))) {
		if (video.paused || video.ended || video.readyState < 3) continue
		if (!best || video.clientWidth * video.clientHeight > best.clientWidth * best.clientHeight) best = video
	}
	return best
}
function startWatchTimer(platform: Platforms) {
	// saved every tick rather than in batches: a tab closed mid-batch used to lose up to a minute,
	// and pagehide can't be relied on to finish an async storage write
	setInterval(() => {
		const video = isOnPlayerPage() ? getPlayingVideo() : undefined
		watchTick(watchState, video?.currentTime, WATCH_TICK_SECONDS)
		flushWatchTime(platform)
	}, WATCH_TICK_SECONDS * 1000)
	globalThis.addEventListener("pagehide", () => flushWatchTime(platform))
}
async function flushWatchTime(platform: Platforms) {
	if (!watchState.pendingSeconds) return
	const seconds = watchState.pendingSeconds
	watchState.pendingSeconds = 0
	const { watchLog } = await browser.storage.local.get("watchLog")
	await browser.storage.local.set({
		watchLog: addWatchSeconds((watchLog as WatchLog) ?? {}, new Date(), platform, seconds),
	})
}

// the best-rated titles shown on cards this week, for the Stats tab
// (films you've already logged on Letterboxd aren't recommendations, so they're left out)
let seenQueue: SeenTitle[] = []
let watchlistQueue: SeenTitle[] = []
let seenFlushTimer: ReturnType<typeof setTimeout> | undefined
function queueSeenTitle(entry: SeenTitle, personal: { watched: boolean; watchlist: boolean }) {
	if (personal.watched) return
	seenQueue.push(entry)
	if (personal.watchlist) watchlistQueue.push(entry)
	seenFlushTimer ??= setTimeout(flushSeenTitles, 5000)
}
async function flushSeenTitles() {
	const entries = seenQueue
	const watchlistEntries = watchlistQueue
	seenQueue = []
	watchlistQueue = []
	seenFlushTimer = undefined
	const now = new Date()
	const stored = await browser.storage.local.get(["seenTop", "watchlistSeen"])
	await browser.storage.local.set({
		seenTop: mergeSeenTitles((stored.seenTop as SeenTop) ?? {}, entries, now),
		watchlistSeen: mergeSeenTitles((stored.watchlistSeen as SeenTop) ?? {}, watchlistEntries, now),
	})
}
// #endregion

// #endregion

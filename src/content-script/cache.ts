// Ratings already looked up, kept in local storage for a month so a title isn't looked up on every page
import { debugLog } from "@/utils/log"
import { getExternalRating, prefetchLetterboxd, searchTitle } from "@/utils/lookup"
import { usesSource } from "@/utils/rating-sources"
import type { FriendRating, RatingSource } from "@/utils/ratings"
import { settings } from "@/stores/settings"
import { locale, ratingSources } from "./settings"
import type { RatingSources } from "@/stores/storeTypes"

export type MovieInfo = {
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
// cached under the current lookup rules and the current choice of sources
export const isCacheCurrent = (entry: MovieInfo | undefined) =>
	!entry?.retryAfter && entry?.cacheVersion === CACHE_VERSION && (entry.sources ?? "both") === ratingSources()

// the cache dates entries by day (UTC)
export const today = () => new Date().toISOString().split("T")[0]
export function getDiffInDays(firstDate: string, secondDate: Date) {
	if (!firstDate || !secondDate) return 31
	return Math.round(Math.abs(new Date(secondDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24))
}
// how long a record should be kept in the cache
export const GCdiff = 30

type DBCacheType = {
	[title: string]: MovieInfo
}
let DBCache: DBCacheType = {}
export const cached = (title: string): MovieInfo | undefined => DBCache[title]

export async function loadCache() {
	const result = await browser.storage.local.get("DBCache")
	DBCache = result?.DBCache as DBCacheType
	if (typeof DBCache !== "object") {
		debugLog("DBCache not found, creating new one", DBCache)
		// best effort: a full or failing storage still leaves ratings running on the in-memory cache
		await browser.storage.local.set({ DBCache: {} }).catch(console.error)
		DBCache = {}
	}
	if (getDiffInDays(settings.value.General.GCdate, new Date()) >= GCdiff) garbageCollection()

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
let cacheSaveTimer: ReturnType<typeof setTimeout> | undefined
export function scheduleCacheSave() {
	cacheSaveTimer ??= setTimeout(() => {
		cacheSaveTimer = undefined
		setDBCache()
	}, 3000)
}

async function garbageCollection() {
	// clear every rating older than 30 days
	// clear every rating where db != tmdb
	debugLog("garbageCollection started, deleting old ratings:")
	const keys = Object.keys(DBCache)
	for (const key of keys) {
		if (getDiffInDays(DBCache[key].date, new Date()) >= GCdiff || DBCache[key].db != "tmdb") {
			debugLog(DBCache[key].date, key)
			delete DBCache[key]
		}
	}
	settings.value.General.GCdate = today()
	setDBCache()
}

export async function lookupMovieInfo(
	title: string,
	media_type: string | null,
	year: string | null,
	sources: RatingSources = ratingSources(),
): Promise<MovieInfo | null> {
	const friends = settings.value.General.friendsRatings
	if (media_type !== "tv" && usesSource(sources, "letterboxd")) prefetchLetterboxd(title, friends)
	// no match, or TMDb unreachable: show nothing and leave the title uncached so the next visit retries
	const movie = await searchTitle(title, media_type, year, locale())
	if (!movie) return null
	const resolvedMediaType = media_type ?? movie.media_type
	const external = await getExternalRating(movie.id, resolvedMediaType, title, sources, friends)
	const compiledData: MovieInfo = {
		id: movie.id,
		media_type: resolvedMediaType,
		score: movie.vote_average,
		vote_count: movie.vote_count,
		release_date: movie.release_date || movie.first_air_date,
		title: movie.title || movie.original_title || movie.name || movie.original_name,
		poster_path: movie.poster_path ?? null,
		date: today(),
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

import { installPageFeatureStyle } from "@/utils/page-feature-styles"
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
import { pickBestMatch } from "@/utils/tmdb"
import { getAccount, onAccountChanged } from "@/utils/account"
import { RowPresentation, normalizeRowScore, isBelowRatingCutoff } from "@/utils/row-presentation"
import {
	DetailRatings,
	SearchRatingSort,
	type FeatureSite,
	type FeatureRating,
	type EpisodeRating,
} from "@/utils/page-features"
import { CreditsRatingPrompt } from "@/utils/letterboxd-actions"
import {
	addWatchSeconds,
	localDateKey,
	mergeSeenTitles,
	type SeenTitle,
	type SeenTop,
	type WatchLog,
} from "@/utils/stats"
console.log("shared-functions loaded")
// Global Variables

const { data: settings, promise } = useBrowserSyncStorage<settingsType>("settings", defaultSettings)
const { data: hiddenTitles, promise: hiddenTitlesPromise } = useBrowserLocalStorage<HiddenTitles>(
	"hiddenTitles",
	{},
	false,
)
export const date = new Date()
const today = date.toISOString().split("T")[0]

const ua = navigator.userAgent
const isMobile = /mobile|streamingEnhanced/i.test(ua)
let url = globalThis.location.href
const hostname = globalThis.location.hostname
const title = document.title
let isPrimeVideo = /amazon|primevideo/i.test(hostname) && (/video/i.test(title) || /video/i.test(url))
let isNetflix = /netflix/i.test(hostname)
let isDisney = /disneyplus|starplus/i.test(hostname)
let isHotstar = /hotstar|jiostar|jiocinema/i.test(hostname)
let isHBO = /max.com/i.test(hostname)
let isParamount = /paramount/i.test(hostname) || /paramountplus/i.test(hostname)
const htmlLang = document.documentElement.lang

const AmazonVideoClass = ".dv-player-fullscreen video"
let DBCache: DBCacheType = {}

export enum Platforms {
	Netflix = "netflix",
	Amazon = "amazon",
	StarPlus = "starplus",
	Disney = "disney",
	Hotstar = "hotstar",
	Crunchyroll = "crunchyroll",
	HBO = "hbo",
	Paramount = "paramount",
}

let activePlatform: Platforms | null = null
export async function startSharedFunctions(platform: Platforms) {
	activePlatform = platform
	startWatchTimer(platform)
	if (platform != Platforms.Crunchyroll) loadLetterboxdProfile()
	if (platform == Platforms.Amazon) isPrimeVideo = true
	if (platform == Platforms.Netflix) isNetflix = true
	if (platform == Platforms.Disney) isDisney = true
	if (platform == Platforms.Hotstar) isHotstar = true
	if (platform == Platforms.HBO) isHBO = true
	if (platform == Platforms.Paramount) isParamount = true

	await promise
	if (isNetflix || isPrimeVideo) {
		await hiddenTitlesPromise
		console.log("hiddenTitles", hiddenTitles.value)
	}
	if (settings.value.Video.playOnFullScreen) startPlayOnFullScreen()
	getDBCache()
	if (isNetflix || isPrimeVideo || isHBO) startPageFeatures()
}
export function getCurrentEpisodeNumber(title: string | null | undefined) {
	if (!title) return null

	// Works across "Season 2, Ep. 1", "Staffel 2, F. 1", etc.
	const nums = title.match(/\d+/g)?.map(Number) ?? []
	if (nums.length === 0) return null
	// usually [season, episode] -> take last number
	return nums.at(-1)
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
	cacheVersion?: number
}
// bump when lookups change so older entries (wrong matches, fallbacks saved during an outage) are refetched once
const CACHE_VERSION = 2
type DBCacheType = {
	[title: string]: MovieInfo
}
async function getDBCache() {
	const result = await browser.storage.local.get("DBCache")
	DBCache = result?.DBCache as DBCacheType
	if (typeof DBCache !== "object") {
		console.log("DBCache not found, creating new one", DBCache)
		try {
			await browser.storage.local.set({ DBCache: {} })
		} catch (error) {
			console.log(error)
		}
		DBCache = {}
	}
	if (isNetflix) {
		if (settings.value.Netflix?.showRating || settings.value.Netflix?.hideTitles)
			startShowRatingInterval(settings.value.Netflix?.showRating, settings.value.Netflix?.hideTitles)
	} else if (isDisney || isHotstar) {
		if (settings.value.Disney?.showRating || settings.value.Disney?.hideTitles)
			startShowRatingInterval(settings.value.Disney?.showRating, settings.value.Disney?.hideTitles)
	} else if (isPrimeVideo) {
		if (settings.value.Amazon?.showRating || settings.value.Amazon?.hideTitles)
			startShowRatingInterval(settings.value.Amazon?.showRating, settings.value.Amazon?.hideTitles)
	} else if (isHBO && settings.value.HBO?.showRating) startShowRatingInterval()
	else if (isParamount && settings.value.Paramount?.showRating) startShowRatingInterval()
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
		console.log("updateDBCache size:", megaBytes.toFixed(4) + " MB")
		await browser.storage.local.set({ DBCache })
	} else {
		console.log("DBCache cleared", megaBytes)
		DBCache = {}
		await browser.storage.local.set({ DBCache })
	}
}

// how long a record should be kept in the cache
const GCdiff = 30
async function garbageCollection() {
	// clear every rating older than 30 days
	// clear every rating where db != tmdb
	console.log("garbageCollection started, deleting old ratings:")
	const keys = Object.keys(DBCache)
	for (const key of keys) {
		if (getDiffInDays(DBCache[key].date, date) >= GCdiff || DBCache[key].db != "tmdb") {
			console.log(DBCache[key].date, key)
			delete DBCache[key]
		}
	}
	settings.value.General.GCdate = today
	setDBCache()
}
// #region exported functions
// parse string time to seconds e.g. 1:30 -> 90
export function parseAdTime(adTimeText: string | null) {
	if (!adTimeText) return false
	const adTime: number =
		Number.parseInt(/:\d+/.exec(adTimeText ?? "")?.[0].substring(1) ?? "") +
		Number.parseInt(/\d+/.exec(adTimeText ?? "")?.[0] ?? "") * 60
	if (Number.isNaN(adTime)) return false
	return adTime
}

export function createSlider(
	video: HTMLVideoElement,
	videoSpeed: Ref<number>,
	position: HTMLElement,
	sliderStyle: string,
	speedStyle: string,
	divStyle = "",
	cleanupTarget: HTMLElement | null | undefined = null,
) {
	videoSpeed.value = videoSpeed.value || video.playbackRate

	const slider = document.createElement("input")
	slider.id = "videoSpeedSlider"
	slider.type = "range"
	slider.min = settings.value.General.sliderMin.toString()
	slider.max = settings.value.General.sliderMax.toString()
	slider.value = (videoSpeed.value * 10).toString()
	slider.step = settings.value.General.sliderSteps.toString()
	slider.style.cssText = sliderStyle

	const speed = document.createElement("p")
	speed.id = "videoSpeed"
	speed.textContent = videoSpeed.value ? videoSpeed.value.toFixed(1) + "x" : "1.0x"
	watch(videoSpeed, (newValue) => {
		speed.textContent = newValue.toFixed(1) + "x"
		slider.value = (newValue * 10).toString()
	})
	speed.style.cssText = speedStyle
	if (divStyle) {
		const div = document.createElement("div")
		div.style.cssText = divStyle
		div.appendChild(slider)
		div.appendChild(speed)
		position.prepend(div)
	} else position.prepend(slider, speed)

	// removes slider if the target element is removed from the DOM
	if (cleanupTarget) {
		const cleanup = () => {
			if (divStyle) {
				slider.parentElement?.remove()
			} else {
				slider.remove()
				speed.remove()
			}
		}
		const cleanupObserver = new MutationObserver(() => {
			if (!cleanupTarget.isConnected) {
				cleanup()
				cleanupObserver.disconnect()
			}
		})
		cleanupObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
		if (!cleanupTarget.isConnected) {
			cleanup()
			cleanupObserver.disconnect()
		}
	}

	if (videoSpeed.value) video.playbackRate = videoSpeed.value
	speed.onclick = function (event) {
		event.stopPropagation()
		event.preventDefault()
		event.stopImmediatePropagation()
		slider.style.display = slider.style.display === "block" ? "none" : "block"
	}
	slider.onclick = function (event) {
		event.stopPropagation()
		event.preventDefault()
		event.stopImmediatePropagation()
	}
	slider.oninput = function (event) {
		event.stopPropagation()
		event.preventDefault()
		event.stopImmediatePropagation()
		const sliderValue = Number.parseFloat(slider.value)
		speed.textContent = (sliderValue / 10).toFixed(1) + "x"
		video.playbackRate = sliderValue / 10
		videoSpeed.value = sliderValue / 10
	}

	return { slider, speed }
}
// #endregion

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
async function getMovieInfo(
	title: string,
	card: HTMLElement,
	media_type: string | null = null,
	year: string | null = null,
) {
	const key = `${title}|${media_type ?? ""}|${year ?? ""}`
	let lookup = lookupsInFlight.get(key)
	if (!lookup) {
		lookup = lookupMovieInfo(title, media_type, year).finally(() => lookupsInFlight.delete(key))
		lookupsInFlight.set(key, lookup)
	}
	const info = await lookup
	if (info) setRatingOnCard(card, info, title)
}

async function lookupMovieInfo(
	title: string,
	media_type: string | null,
	year: string | null,
): Promise<MovieInfo | null> {
	const locale = htmlLang || navigator?.language || "en-US"
	const queryType = media_type ?? "multi"
	let url = `https://api.themoviedb.org/3/search/${queryType}?query=${encodeURIComponent(title)}&include_adult=false&language=${locale}&page=1`
	if (year) url += `&year=${year}`
	// start downloading the likely Letterboxd page now; it's verified against TMDb's answer before being used
	if (media_type !== "tv")
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
		? await getExternalRating(movie.id, resolvedMediaType, title)
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
// Films: Letterboxd. TV, and films Letterboxd has no rating for yet: IMDb.
async function getExternalRating(
	tmdbId: number,
	media_type: string,
	title: string,
): Promise<{ rating: ExternalRating | null; transient: boolean }> {
	let transient = false
	try {
		// Letterboxd's /tmdb/{id} only understands movie ids, a TV id would resolve to an unrelated film
		if (media_type === "movie") {
			const letterboxd: ExternalResult = await sendMessage(
				"letterboxdRating",
				{ tmdbId, friends: settings.value.General.friendsRatings, title },
				"background",
			)
			if (isLookupError(letterboxd)) transient = true
			else if (letterboxd?.rating) return { rating: letterboxd, transient }
		}
		if (media_type !== "movie" && media_type !== "tv") return { rating: null, transient }
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
		console.error("getExternalRating failed", tmdbId, media_type, error)
		return { rating: null, transient: true }
	}
}

// The user's Letterboxd diary and watchlist (synced by the background every few hours)
let letterboxdProfile: LetterboxdProfile | null = null
const rowPresentation = new RowPresentation()
const rowCardData = new WeakMap<HTMLElement, MovieInfo>()
const rowCardTitles = new WeakMap<HTMLElement, string>()
const rowCardDecorations = new WeakMap<HTMLElement, HTMLElement[]>()
function refreshRowPresentation() {
	const stale = rowPresentation.prune(
		(card) => getCleanTitle(card, card.dataset.cardTitle ? 0 : 1) === rowCardTitles.get(card),
	)
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
			highlightBest: !!enabled && settings.value.General.highlightBestInRow,
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
					settings.value.General.RatingThresholds[0].value,
				)
			)
		},
	)
}
watch(
	() => [
		settings.value.General.highlightBestInRow,
		settings.value.General.fadeWatched,
		settings.value.General.hideBelowRating,
		settings.value.General.dimBelowBand,
		settings.value.Netflix?.showRating,
		settings.value.Amazon?.showRating,
		settings.value.HBO?.showRating,
	],
	refreshRowPresentation,
)
let watchlistSlugs = new Set<string>()

const searchSorting = new SearchRatingSort()
const creditsPrompt = new CreditsRatingPrompt()
let playerLookup: { title: string; data: FeatureRating | null; pending?: Promise<unknown>; retry: number } | null = null
const detailRatings = new DetailRatings(
	async (title, type, year) => {
		const cached = DBCache[title]
		if (
			cached?.cacheVersion === CACHE_VERSION &&
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
	(data) => {
		const slug = getLetterboxdSlug(data.rating_url)
		return slug ? { watched: letterboxdProfile?.watched[slug], watchlist: watchlistSlugs.has(slug) } : {}
	},
	(panel, data) => {
		if (!settings.value.General.letterboxdActions || !letterboxdUsername || data.media_type !== "movie") return
		const slug = getLetterboxdSlug(data.rating_url)
		if (!slug) return
		const button = document.createElement("button")
		button.type = "button"
		button.className = "sb-feature-button sb-letterboxd-action"
		// The synced public-profile account is not proof of the browser's signed-in account.
		button.textContent = "Add to Letterboxd watchlist"
		button.addEventListener("click", async () => {
			if (
				!settings.value.General.letterboxdActions ||
				!window.confirm(`Add “${data.title}” to the watchlist of your currently signed-in Letterboxd account?`)
			)
				return
			button.disabled = true
			button.textContent = "Adding…"
			button.setAttribute("aria-busy", "true")
			panel.querySelector('[role="status"]')?.remove()
			try {
				const result = (await sendMessage("letterboxdAddWatchlist", { slug, confirmed: true }, "background")) as {
					success?: boolean
					error?: string
				}
				if (!result.success) throw new Error(result.error ?? "Unable to update Letterboxd")
				button.textContent = "Added to watchlist"
				const success = document.createElement("small")
				success.setAttribute("role", "status")
				success.textContent = "Added to your signed-in Letterboxd account."
				panel.append(success)
			} catch (error) {
				button.disabled = false
				button.textContent = "Retry watchlist add"
				const note = document.createElement("small")
				note.setAttribute("role", "status")
				note.textContent = (error as Error).message
				panel.querySelector('[role="status"]')?.remove()
				panel.append(note)
			} finally {
				button.removeAttribute("aria-busy")
			}
		})
		panel.append(button)
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
		detailRatings
			.tick(featureSite(), {
				panel: settings.value.General.detailRatings,
				episodes: settings.value.General.episodeRatings,
				actions: settings.value.General.letterboxdActions,
				friends: settings.value.General.friendsRatings,
			})
			.catch((error) => console.debug("streamBuddy page ratings:", error))
		updateSearchSorting()
		updateCreditsPrompt()
	}
	setInterval(tick, 1000)
	watch(
		() => [
			settings.value.General.detailRatings,
			settings.value.General.episodeRatings,
			settings.value.General.searchSort,
			settings.value.General.letterboxdActions,
			settings.value.General.friendsRatings,
			settings.value.General.rateOnCredits,
		],
		tick,
	)
	tick()
}

function updateCreditsPrompt() {
	const enabled = settings.value.General.rateOnCredits && !!letterboxdUsername
	if (!enabled) {
		creditsPrompt.tick(null, null, false)
		return
	}
	if (!isOnPlayerPage()) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const video = document.querySelector<HTMLVideoElement>("video")
	if (!video || !Number.isFinite(video.duration) || video.duration < 1200 || video.currentTime < video.duration - 90) {
		creditsPrompt.tick(null, null, true)
		return
	}
	if (
		document.querySelector('[data-testid="player-ux-season-episode"]') ||
		/(?:S\d+\s*:?\s*E\d+|Season\s+\d+|Episode\s+\d+)/i.test(document.title)
	) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const raw = isNetflix ? document.querySelector('[data-uia="video-title"] h4')?.textContent : document.title
	const title = raw
		?.replace(/^Prime Video:\s*/i, "")
		.split(/\s*[•·|]\s*/)[0]
		?.trim()
	if (!title || /^(Netflix|Prime Video|HBO\s*Max)$/i.test(title)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	if (playerLookup?.title !== title) playerLookup = { title, data: null, retry: 0 }
	if (!playerLookup.pending && !playerLookup.data && playerLookup.retry <= Date.now()) {
		const current = playerLookup
		current.pending = lookupMovieInfo(title, null, null)
			.then((data) => {
				current.data = data
			})
			.catch(() => {})
			.finally(() => {
				current.pending = undefined
				current.retry = Date.now() + 30_000
			})
	}
	creditsPrompt.tick(video, playerLookup.data, true)
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

// show rating depending on page
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/g
function showRating() {
	if (isDisney) {
		url = globalThis.location.href
		// disable search and suggested movies
		if (url.includes("search")) return false
		if (url.includes("entity")) {
			const SelectedTab = document.querySelector('[aria-selected="true"]')
			return (
				uuidRegex.test(SelectedTab?.id?.split("_control")?.[0] ?? "") &&
				SelectedTab?.getAttribute("aria-label") != "EXTRAS"
			)
		}
		return true
	} else if (isPrimeVideo) {
		// suggested movies
		if (globalThis.location.href.includes("detail")) {
			return document.querySelector('[data-testid="btf-related-tab"]')?.getAttribute("tabIndex") == "0"
		}
		return true
	} else return true
}
// hideTitles is used to manually hide shows from the page
async function startShowRatingInterval(optionShowRating = true, optionHideTitles = false) {
	if (showRating()) addRating(optionShowRating, optionHideTitles)
	// New cards get rated on the next frame after they appear instead of on the next 1s tick. Player pages mutate
	// constantly and have no cards, so they're ignored; the interval stays as a safety net and to stop when switched off.
	let stopped = false
	let tickScheduled = false
	const scheduleTick = () => {
		if (stopped || tickScheduled || document.hidden || isOnPlayerPage()) return
		tickScheduled = true
		setTimeout(() => {
			tickScheduled = false
			if (!stopped && showRating()) addRating(optionShowRating, optionHideTitles)
		}, 16)
	}
	const observer = new MutationObserver(scheduleTick)
	observer.observe(document.body, { childList: true, subtree: true })
	globalThis.addEventListener("scroll", scheduleTick, { passive: true, capture: true })
	const RatingInterval = setInterval(function () {
		refreshRowPresentation()
		if (isNetflix) {
			optionShowRating = settings.value.Netflix?.showRating
			optionHideTitles = settings.value.Netflix?.hideTitles
		} else if (isDisney || isHotstar) {
			optionShowRating = settings.value.Disney?.showRating
			optionHideTitles = settings.value.Disney?.hideTitles
		} else if (isPrimeVideo) {
			optionShowRating = settings.value.Amazon?.showRating
			optionHideTitles = settings.value.Amazon?.hideTitles
		}

		if (
			(isNetflix && !(settings.value.Netflix?.showRating || settings.value.Netflix?.hideTitles)) ||
			(isPrimeVideo && !(settings.value.Amazon?.showRating || settings.value.Amazon?.hideTitles)) ||
			((isDisney || isHotstar) && !(settings.value.Disney?.showRating || settings.value.Disney?.hideTitles)) ||
			(isHBO && !settings.value.HBO?.showRating) ||
			(isParamount && !settings.value.Paramount?.showRating)
		) {
			console.log("stopped adding Rating")
			clearInterval(RatingInterval)
			stopped = true
			observer.disconnect()
			globalThis.removeEventListener("scroll", scheduleTick, { capture: true })
			return
		}
		if (showRating()) addRating(optionShowRating, optionHideTitles)
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
			console.log(
				"update recent movie:",
				title,
				",refresh:",
				getDiffInDays(DBCache[title].date, date),
				",Age:",
				getDiffInDays(DBCache[title]?.release_date, date),
				"Vote count:",
				vote_count,
			)
		else console.log("update old rating:", title, ",Age:", getDiffInDays(DBCache[title].date, date))
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
				'a[data-uia="standard-card"]:not(.imdb), a[data-uia="progress-card"]:not(.imdb), a[data-uia="ranked-card"]:not(.imdb)',
			),
		]
	else if (isDisney)
		AllTitleCardsTypes = [document.querySelectorAll("a[data-testid='set-item']:not([href^='/browse/page']):not(.imdb)")]
	else if (isHotstar)
		AllTitleCardsTypes = [
			document.querySelectorAll(
				"[data-testid='tray-card-default']:not(.imdb), [data-testid='tray-horizontal-card-hover']:not(.imdb)",
			),
		]
	else if (isHBO) AllTitleCardsTypes = [document.querySelectorAll("a[class*='StyledTileLinkNormal-']:not(.imdb)")]
	else if (isParamount)
		AllTitleCardsTypes = [document.querySelectorAll("a[href*='/shows']:not(.imdb), a[href*='/movies']:not(.imdb)")]
	else if (isPrimeVideo)
		AllTitleCardsTypes = [
			document.querySelectorAll(
				"li article[data-card-title]:not([data-card-entity-type='EVENT']):not([data-card-title='Live-TV']):not(:has(#rating))",
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

async function addRating(showRating: boolean, optionHideTitles: boolean) {
	url = globalThis.location.href
	const AllTitleCardsTypes = getAllTitleCardsTypes()
	// on disney there are multiple images for the same title so only use the first one
	let lastTitle = ""
	// for each is not going in order on chrome
	let updateDBCache = false
	for (let type = 0; type < AllTitleCardsTypes.length; type++) {
		const titleCards = AllTitleCardsTypes[type]
		for (let i = 0; i < titleCards.length; i++) {
			const card = titleCards[i] as HTMLElement
			// add seen class
			if (isNetflix || isDisney || isHotstar || isHBO || isParamount) card.classList.add("imdb")
			else if (isPrimeVideo) {
				if (type == 0) card?.closest("li")?.classList.add("imdb")
				else if (type == 1) card?.classList.add("imdb")
			}
			const media_type = getMediaType(card)
			const title = getCleanTitle(card, type)
			if (!title) continue
			if (optionHideTitles) {
				if (hiddenTitles.value[title]) {
					let item
					if (isNetflix) item = (card.closest("[data-virtual-slot]") || card.parentElement) as HTMLElement
					else if (isDisney) item = card.parentElement as HTMLElement
					else if (isHotstar)
						item = (card.closest("[data-testid='tray-card-default']") ||
							card.closest("a") ||
							card.parentElement) as HTMLElement
					else if (isPrimeVideo) item = card.closest("li") as HTMLElement

					if (item) {
						if (item.style.display === "none") continue
						item.style.display = "none"
					}
					settings.value.Statistics.SegmentsSkipped++
					sendMessage("increaseBadge", {}, "background")
					console.log("hidden Title", title)
					continue
				}
				if (isDisney || isHotstar || isPrimeVideo) addHideTitleButton(card, title, media_type, type)
			}

			// for the static Pixar Disney, Starplus etc. cards
			if (showRating && (!isDisney || !card?.classList.contains("_1p76x1y4"))) {
				// sometimes more than one image is loaded for the same title
				if (lastTitle != title && !title.includes("Netflix") && !title.includes("Prime Video")) {
					lastTitle = title
					if (
						DBCache[title]?.cacheVersion === CACHE_VERSION &&
						// a Letterboxd/IMDb rating counts even when TMDb has no votes; unrated titles are retried after a week
						(DBCache[title]?.rating || DBCache[title]?.score || getDiffInDays(DBCache[title]?.date, date) <= 7) &&
						(!media_type || DBCache[title]?.media_type == media_type)
					) {
						useDBCache(title, card, media_type)
					}
					// if element is not visible skip it
					else if (!isElementVisible(card)) {
						if (isNetflix || isDisney || isHotstar || isHBO || isParamount) card.classList.remove("imdb")
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
function addHideTitleButton(card: HTMLElement, title: string, mediaType: MediaType, cardType = 0) {
	let target: HTMLElement
	if (isHotstar) {
		// For Hotstar, always target the outermost card container to avoid breaking internal layout
		target = (card.closest("[data-testid='tray-card-default']") ||
			card.closest("[data-testid='tray-horizontal-card-hover']") ||
			card) as HTMLElement
	} else if (isPrimeVideo) {
		target = (cardType == 0 ? card?.querySelector('[data-testid="packshot"]') : card) as HTMLElement
	} else {
		target = card.parentElement as HTMLElement
	}
	if (!target || target.querySelector(".sb-hide-title")) return
	if (isPrimeVideo && getComputedStyle(target).position === "static") target.style.position = "relative"

	const button = document.createElement("button")
	installPageFeatureStyle()
	button.type = "button"
	button.className = "sb-hide-title"
	button.textContent = "×"
	button.setAttribute("aria-label", `Hide ${title}`)
	button.title = `Hide ${title}. Restore it in Hidden titles.`
	button.onclick = function (event) {
		// stop propagation
		event.stopPropagation()
		event.preventDefault()
		const item = target
		if (item) {
			if (isDisney || isHotstar) item.style.display = "none"
			else if (isPrimeVideo) {
				const li = card.closest("li")
				if (li) li.style.display = "none"
			}
		}
		hiddenTitles.value[title] = {
			platform: isPrimeVideo ? "Amazon" : "Disney",
			mediaType,
			posterPath: DBCache[title]?.poster_path ?? null,
			dateAdded: today,
		}
	}
	target.appendChild(button)
}
function getMediaType(card: HTMLElement): MediaType {
	let media_type: MediaType = null
	if (isNetflix) {
		if (url.includes("genre/83")) media_type = "tv"
		else if (url.includes("genre/34399")) media_type = "movie"
	} else if (isDisney) {
		if (url.includes("browse/series")) media_type = "tv"
		else if (url.includes("browse/movies")) media_type = "movie"
		else if (/(Staffel)|(Nummer)|(Season)|(Episod)|(Number)/g.test(title ?? "")) media_type = "tv"
	} else if (isParamount) {
		const href = card.getAttribute("href") || ""
		if (href.includes("/shows/")) media_type = "tv"
		else if (href.includes("/movies/")) media_type = "movie"
	} else if (isHBO) {
		const href = card.getAttribute("href") || ""
		if (href.includes("show") || href.includes("series")) media_type = "tv"
		else if (href.includes("movie")) media_type = "movie"
	} else if (isPrimeVideo) {
		if (url.includes("video/tv")) media_type = "tv"
		else if (url.includes("video/movie")) media_type = "movie"
		else media_type = Amazon_getMediaType(card.dataset.cardEntityType ?? "")
	} else if (isHotstar) {
		if (url.includes("/movies/")) media_type = "movie"
		else if (url.includes("/tv-shows/")) media_type = "tv"
	}
	return media_type
}

function getCleanTitle(card: HTMLElement, type: number): string | undefined {
	let title: string | undefined
	if (isNetflix) {
		title = card?.getAttribute("aria-label")?.split(" (")[0]
	} else if (isDisney) {
		const prompt = card.querySelector('div[data-testid="hero-carousel-prompt"]')
		if (prompt?.textContent)
			title = Disney_fixTitle(card?.getAttribute("aria-label")?.replace(" " + prompt.textContent, ""))
		else title = Disney_fixTitle(card?.getAttribute("aria-label") ?? undefined)
		// no section Extras on disney shows
		if (url.includes("entity")) {
			const SelectedTabId = document.querySelector('[aria-selected="true"]')?.id.split("_control")[0]
			if (SelectedTabId != card.closest('div[role="tabpanel"]')?.id) title = ""
		}
	} else if (isHotstar) {
		const rawTitle =
			card?.querySelector("[data-testid='action']")?.getAttribute("aria-label") ||
			card?.querySelector("a")?.getAttribute("aria-label") ||
			card?.getAttribute("aria-label") ||
			card?.getAttribute("alt") ||
			card.querySelector("img")?.getAttribute("alt") ||
			card.querySelector("[data-testid='card-hover-title-cutout'] img")?.getAttribute("alt") ||
			card.querySelector("span")?.textContent ||
			""
		// Cleaning: Remove "S1 E1", trailing numbers like " 2", and split by comma
		title = rawTitle
			.replaceAll(/(S\d+\sE\d+)/g, "")
			.split(",")[0]
			.replace(/\s\d+$/, "") // Remove trailing number (e.g., "Harry Potter 2" -> "Harry Potter")
			.trim()

		if (!title || ["show", "movie", "live", "episode", "special", "free"].includes(title.toLowerCase()))
			title = undefined
	} else if (isPrimeVideo) {
		// detail means not live shows
		if (card.querySelector("a")?.href?.includes("detail")) {
			if (type == 0) title = Amazon_fixTitle(card.dataset.cardTitle ?? "")
			else if (type == 1) title = Amazon_fixTitle(card.querySelector("a")?.getAttribute("aria-label") ?? "")
		}
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
	} else if (isParamount) title = card.getAttribute("title") ?? ""
	return title
}
const Brands = String.raw`Hulu Original Series|Disney\+ Original|STAR (?:Original|Generic)|ZDF Enterprises`
const Badge = String.raw`New(?: (?:Episode|Movie|Series))? Badge|`
export const DISNEY_TITLE_RE_EN = new RegExp(
	[
		String.raw`^`,
		// sometimes there is a "Number 1 " or "Number 2 " badge in the title, but it is not consistent
		String.raw`(?:Number\s+\d+\s+)?`,
		// sometimes there is a "Disney+ Original" or "STAR Original" badge in the title, but it is not consistent
		// starting the non capturing group
		String.raw`(?:(?:`,
		String.raw`Catch Up on the Series|`,
		Badge,
		Brands,
		String.raw`)\s+)*`,
		// ending the non capturing group
		String.raw`\s*`,
		// The title is captured in a non-greedy way until we reach one of the following keywords that indicate additional info, or the end of the string
		String.raw`(?<title>[\s\S]+?)`,
		// lookahead for keywords that indicate end of title and start of additional info, e.g. Season
		String.raw`(?=`,
		// these keywords indicate that the title has ended and additional info has started, such as season number, release date, rating, etc.
		String.raw`\s+(?:`,
		String.raw`Season\b|New Episode\b|Rated\b|Released\b|Coming\b|Prepare\b|Catch Up on the Series|`,
		Badge,
		String.raw`Select for details on this title\.|`,
		String.raw`\d+\s+hour\b|\d+\s+minutes remaining\b|`,
		Brands,
		// or the end of the string
		String.raw`)`,
		String.raw`|$`,
		String.raw`)`,
	].join(""),
)

export const DISNEY_TITLE_RE_DE = new RegExp(
	[
		String.raw`^`,
		// ranking badge
		String.raw`(?:Nummer\s+\d+\s+)?`,
		// provider / brand badges (can appear multiple times, sometimes both before and after "Label: ...")
		String.raw`(?:(?:${Brands})\s+)*`,
		// label badge (can appear multiple times, and may appear before the actual title)
		String.raw`(?:Label:\s+(?:Neuer Film|Neue Serie|Neue Folge|Neu)\s+)*`,
		String.raw`\s*`,
		// Sometimes the UI contains countdown-only tiles like "Nur noch 60 Sekunden ...".
		String.raw`(?!Nur\s+noch\s+\d+\s+Sekunden\b)`,
		// capture the title until we reach one of the known metadata / CTA markers
		String.raw`(?<title>[\s\S]+?)`,
		String.raw`(?=`,
		String.raw`\s+(?:`,
		// typical UI strings
		String.raw`Jetzt\s+aufholen\b|Altersfreigabe:|Erscheinungsjahr:|Genre:|Label:|`,
		String.raw`Ab\b|ab\b|Neue Folge\b|Mach\s+dich\s+bereit\b|`,
		String.raw`Für\s+Details\s+zu\s+diesem\s+Titel\s+auswählen\.|`,
		String.raw`Staffel\b|Folge\b|Noch\b|\d+\s*Stunde\b|\d+\s*Stunden\b|\d+\s*Minuten\b|`,
		Brands,
		String.raw`)`,
		String.raw`|$`,
		String.raw`)`,
	].join(""),
	"u",
)
export function Disney_fixTitle(title: string | undefined): string | undefined {
	// else (htmlLang == "en" || htmlLang == "en-US" || htmlLang == "en-GB")
	const regex = htmlLang == "de" ? DISNEY_TITLE_RE_DE : DISNEY_TITLE_RE_EN
	return title?.match(regex)?.groups?.title?.trim()
}
// HBO tile labels wrap each part in bidi isolation marks: "⁦⁨⁨Freddy vs. Jason⁩⁩. ⁨6 of 20⁩. ⁨Just Added⁩⁩⁩"
// or "⁦⁨⁨Mad Max⁩⁩. ⁨Row 1 of 5, Column 2 of 6⁩⁩". The title is whatever comes before the first
// closing mark (U+2069), so this works whatever the position suffix says.
export function HBO_fixTitle(label: string | null | undefined): string | undefined {
	if (!label) return undefined
	const firstPart = label.includes("\u2069") ? label.slice(0, label.indexOf("\u2069")) : label
	const title = firstPart.replaceAll(/[\u2066-\u2069\u200e\u200f]/g, "").trim()
	return title || undefined
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

export function getColorForRating(rating: number, lowVoteCount: boolean) {
	// I want a color gradient from red to green with yellow in the middle
	// the ratings are between 0 and 10
	// the average rating is 6.5
	// https://distributionofthings.com/imdb-movie-ratings/
	if (!rating || lowVoteCount) return "grey"
	for (const threshold of settings.value.General.RatingThresholds) {
		if (rating <= threshold.value) {
			return threshold.color
		}
	}
}
export function getIsTransparent(rating: number, lowVoteCount: boolean) {
	if (!settings.value.Video?.dimLowRatings) return false
	if ((!rating || rating <= settings.value.General.RatingThresholds[0].value) && !lowVoteCount) return true
	return false
}
// Letterboxd and IMDb dim by colour band (the cut-off is picked in the popup); TMDb keeps the old threshold
function isDimmed(data: MovieInfo, lowVoteCount: boolean) {
	if (!settings.value.Video?.dimLowRatings) return false
	if (data?.source !== "tmdb" && data?.rating)
		return getScoreBand(data.source, data.rating) < settings.value.General.dimBelowBand
	return getIsTransparent(data?.score, lowVoteCount)
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
// Score on top, coloured by how it ranks among what's streaming. Underneath, smaller: friends' Letterboxd
// average, then your own status (seen it and what you gave it, or on your watchlist).
// Keep the source and scale visible; colour adds context rather than carrying the meaning.
function addBadgeLine(div: HTMLElement, text: string, color: string) {
	const line = document.createElement("span")
	line.textContent = text
	Object.assign(line.style, { fontSize: "max(11px, 0.82em)", fontWeight: "500", color, letterSpacing: "0.01em" })
	div.appendChild(line)
}
const formatCount = (count = 0) =>
	count >= 1e6 ? `${(count / 1e6).toFixed(1)}M` : count >= 1e3 ? `${Math.round(count / 1e3)}K` : String(count)
function fillBadge(div: HTMLElement, data: MovieInfo, prefix: string, tmdbColor: string | undefined) {
	const main = document.createElement("span")
	main.style.fontSize = "1.08em"
	const tooltip: string[] = []
	if (data.source === "letterboxd") {
		main.textContent = prefix + "LB " + data.rating?.toFixed(2) + "/5"
		main.style.color = getScoreColor("letterboxd", data.rating ?? 0)
		tooltip.push(`Letterboxd ${data.rating?.toFixed(2)} · ${formatCount(data.rating_count)} ratings`)
	} else if (data.source === "imdb") {
		main.textContent = prefix + "IMDb " + data.rating?.toFixed(1) + "/10"
		main.style.color = getScoreColor("imdb", data.rating ?? 0)
		tooltip.push(`IMDb ${data.rating?.toFixed(1)} · ${formatCount(data.rating_count)} ratings`)
	} else {
		main.textContent = prefix + "TMDb " + data.score?.toFixed(1) + "/10"
		main.style.color = tmdbColor ?? "#fff"
		tooltip.push(`TMDb ${data.score?.toFixed(1)} (no Letterboxd or IMDb rating)`)
	}
	div.appendChild(main)
	if (data.source === "letterboxd" && data.friends_rating && settings.value.General.friendsRatings) {
		addBadgeLine(div, "friends " + data.friends_rating.toFixed(1), "#aab3bc")
		const names = (data.friends ?? []).map((friend) => `${friend.name} ${friend.rating.toFixed(1)}`).join(", ")
		tooltip.push(
			`Friends ${data.friends_rating.toFixed(1)} from ${data.friends_count}${names ? `: ${names}` : ""}${(data.friends_count ?? 0) > (data.friends?.length ?? 0) ? "…" : ""}`,
		)
	}
	const personal = getPersonalStatus(data)
	if (personal.watched !== undefined) {
		addBadgeLine(div, personal.watched ? `✓ you ${personal.watched.toFixed(1)}` : "✓ seen", "#e8eaed")
		tooltip.push(personal.watched ? `You rated it ${personal.watched.toFixed(1)}` : "You've logged it")
	} else if (personal.watchlist) {
		addBadgeLine(div, "watchlist", "#40bcf4")
		tooltip.push("On your watchlist")
	}
	div.title = tooltip.join("\n")
	div.setAttribute("aria-label", tooltip.join(". "))
}

async function setRatingOnCard(card: HTMLElement, data: MovieInfo, title: string) {
	if (!card.isConnected) return
	if ((isNetflix || isHBO || isPrimeVideo) && getCleanTitle(card, card.dataset.cardTitle ? 0 : 1) !== title) {
		card.classList.remove("imdb")
		card.closest("li")?.classList.remove("imdb")
		return
	}
	let div: HTMLElement
	if (data?.id) {
		if (isHotstar) {
			div = document.createElement("div")
			div.style.cursor = "pointer"
			div.setAttribute("role", "link")
			div.tabIndex = 0
			const openRating = () =>
				window.open(data.rating_url ?? getTMDBUrl(data.id, data.media_type), "_blank", "noopener,noreferrer")
			div.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.stopPropagation()
					event.preventDefault()
					openRating()
				}
			})
			div.onclick = (event) => {
				event.stopPropagation()
				event.preventDefault()
				openRating()
			}
		} else {
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
		console.log("no score found:", title, data, card)
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
	let zIndexValue = "2"
	if (isDisney) zIndexValue = ""
	else if (isPrimeVideo) zIndexValue = "3"
	// dark glass pill, numbers stacked and right-aligned
	Object.assign(div.style, {
		position: "absolute",
		bottom: "0.3em",
		right: isNetflix ? "calc(0.2vw + 0.3em)" : "0.3em",
		display: "flex",
		flexDirection: "column",
		alignItems: "flex-end",
		gap: "0.15em",
		color: "#fff",
		textDecoration: "none",
		background: "rgba(14, 17, 20, 0.82)",
		backdropFilter: "blur(6px)",
		border: "1px solid rgba(255, 255, 255, 0.12)",
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.35)",
		borderRadius: "5px",
		opacity: "0",
		transition: "opacity 160ms ease-out",
		padding: "0.25em 0.4em",
		fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Helvetica, sans-serif',
		fontWeight: "600",
		fontVariantNumeric: "tabular-nums",
		lineHeight: "1",
		zIndex: zIndexValue,
		fontSize: isMobile ? "clamp(12px, 4vw, 18px)" : "clamp(12px, 0.85vw, 15px)",
	})

	requestAnimationFrame(() => (div.style.opacity = "1"))
	{
		let releaseDate = ""
		if (settings.value.Video?.showYear && data?.release_date) {
			releaseDate = new Date(data?.release_date)?.getFullYear() + "-"
		}
		fillBadge(div, data, releaseDate, getColorForRating(score, vote_count < 50))
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
		background: "rgba(40, 40, 40, 0.7)" /* grey with 70% opacity */,
		pointerEvents: "none" /* allows clicks to pass through */,
		zIndex: 2,
	})
	if (isNetflix) {
		const titleCardContainer = (card.closest("div[data-virtual-slot]") ?? card.parentElement) as HTMLElement
		if (titleCardContainer) {
			if (getComputedStyle(titleCardContainer).position === "static") titleCardContainer.style.position = "relative"
			titleCardContainer.appendChild(div)
			if (isDimmed(data, vote_count < 50)) titleCardContainer.appendChild(greyOverlay)
			// titleCardContainer.style.opacity = getTransparencyForRating(data?.score, vote_count < 50)
		}
	} else if (isHBO) {
		// the tile link itself is unpositioned; the poster container is the relative box
		const position = (card.querySelector('[data-testid$="_tileImage"]') as HTMLElement | null) ?? card
		position.appendChild(div)
		if (isDimmed(data, vote_count < 50)) position.appendChild(greyOverlay)
		// card.style.opacity = getTransparencyForRating(data?.score, vote_count < 50)
	} else if (isParamount) {
		card.style.position = "unset"
		card.appendChild(div)
		if (isDimmed(data, vote_count < 50)) card.appendChild(greyOverlay)
		// card.style.opacity = getTransparencyForRating(data?.score, vote_count < 50)
	} else if (isDisney) {
		const parentDiv = card?.closest("div")
		if (parentDiv) {
			if (card.nextElementSibling && !card.nextElementSibling.classList.contains("sb-hide-title")) {
				div.style.top = card.offsetHeight + "px"
				div.style.bottom = ""
			}
			parentDiv.style.position = "relative"
			parentDiv.appendChild(div)
			if (isDimmed(data, vote_count < 50)) parentDiv.appendChild(greyOverlay)
			// parentDiv.style.opacity = getTransparencyForRating(data?.score, vote_count < 50)
		}
	} else if (isHotstar) {
		const targetContainer = card // card is the outermost container from getAllTitleCardsTypes
		if (targetContainer && !targetContainer.querySelector("#rating")) {
			div.style.zIndex = "10"
			targetContainer.appendChild(div)
			if (isDimmed(data, vote_count < 50)) targetContainer.appendChild(greyOverlay)
		}
	} else if (isPrimeVideo) {
		let position: HTMLElement = card
		if (card.dataset.cardTitle) position = card?.firstChild?.firstChild as HTMLElement
		else if (card.querySelector('div[data-testid="title-metadata-main"]'))
			position = card.querySelector('div[data-testid="title-metadata-main"]') as HTMLElement
		position?.appendChild(div)
		if (isDimmed(data, vote_count < 50)) position?.appendChild(greyOverlay)
		// card.closest("li")?.style.setProperty("opacity", getTransparencyForRating(data?.score, vote_count < 50))
	}
	if (div.isConnected && (isNetflix || isHBO || isPrimeVideo)) {
		searchSorting.setRating(card, score)
		const target = isNetflix
			? (card.closest<HTMLElement>("[data-virtual-slot]") ?? card.parentElement)
			: isHBO
				? (card.querySelector<HTMLElement>('[data-testid$="_tileImage"]') ?? card)
				: card
		if (target) {
			rowCardData.set(card, data)
			rowCardTitles.set(card, title)
			rowCardDecorations.set(card, [div, greyOverlay])
			const hideTarget = isNetflix ? target : isPrimeVideo ? (card.closest<HTMLElement>("li") ?? card) : card
			rowPresentation.track(card, target, score, hideTarget)
			refreshRowPresentation()
		}
	}
}
// #region streamBuddy stats
// Watch time only counts on player pages while the video is actually advancing,
// so autoplaying previews on the browse pages and paused players don't add up.
const WATCH_TICK_SECONDS = 15
let pendingWatchSeconds = 0
let lastVideoTime = -1
function isOnPlayerPage() {
	const path = globalThis.location.pathname
	if (isNetflix) return path.startsWith("/watch")
	if (isPrimeVideo) return !!document.querySelector(AmazonVideoClass)
	if (isHBO) return path.includes("/video/watch")
	if (isDisney || isHotstar) return /\/(video|play|watch)\//.test(path)
	if (isParamount) return path.includes("/video/")
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
	setInterval(() => {
		const video = isOnPlayerPage() ? getPlayingVideo() : undefined
		if (video && Math.abs(video.currentTime - lastVideoTime) > 1) pendingWatchSeconds += WATCH_TICK_SECONDS
		lastVideoTime = video?.currentTime ?? -1
		if (pendingWatchSeconds >= 60) flushWatchTime(platform)
	}, WATCH_TICK_SECONDS * 1000)
	globalThis.addEventListener("pagehide", () => flushWatchTime(platform))
}
async function flushWatchTime(platform: Platforms) {
	if (!pendingWatchSeconds) return
	const seconds = pendingWatchSeconds
	pendingWatchSeconds = 0
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

function OnFullScreenChange() {
	let video: HTMLVideoElement
	if (isDisney)
		video = Array.from(document.querySelectorAll("video")).find((v) => v.checkVisibility()) as HTMLVideoElement
	else if (isNetflix || isHotstar || isHBO || isParamount) video = document.querySelector("video") as HTMLVideoElement
	else video = document.querySelector(AmazonVideoClass) as HTMLVideoElement
	if (document.fullscreenElement && video) {
		video.play()
		console.log("auto-played on fullscreen")
		settings.value.Statistics.SegmentsSkipped++
		sendMessage("increaseBadge", {}, "background")
	}
}
async function startPlayOnFullScreen() {
	if (settings.value.Video?.playOnFullScreen) {
		addEventListener("fullscreenchange", OnFullScreenChange)
	} else {
		removeEventListener("fullscreenchange", OnFullScreenChange)
	}
}
// #endregion

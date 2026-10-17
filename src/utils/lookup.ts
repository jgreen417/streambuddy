// How a title gets its rating, from the content script's side: TMDb finds the title, then Letterboxd (films) or IMDb
// (TV, and films Letterboxd has no rating for yet) supply the score. The fetches run in the background (see
// background/index.ts), which holds the API key and isn't blocked by CORS.
import { sendMessage } from "webext-bridge/content-script"
import { logLookupFailure } from "./log"
import { pickBestMatch } from "./tmdb"
import { isLastEpisode, type PlayingEpisode } from "./series-finale"
import { usesSource } from "./rating-sources"
import type { ExternalRating, ImdbEpisodeRating, LetterboxdFilm } from "./ratings"
import type { LookupError } from "./messages"
import type { RatingSources } from "@/stores/storeTypes"

export type TMDBMovie = {
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
type TvDetails = {
	seasons?: Array<{ season_number?: number; episode_count?: number }>
	external_ids?: { imdb_id?: string | null }
}

export const isLookupError = (result: unknown): result is LookupError =>
	!!result && typeof result === "object" && "error" in result

// TMDb's JSON for path (under /3/), or a LookupError when TMDb is unreachable or not set up
async function tmdb<T>(path: string): Promise<T | null | LookupError> {
	const data = await sendMessage("fetch", { url: `https://api.themoviedb.org/3/${path}`, type: "tmdb" }, "background")
	return data as T | null | LookupError
}

// a lookup takes the sources setting as it was when it started, so a change mid-lookup can't mislabel its result

// the best TMDb match for a card's title; null when there's none or TMDb is unreachable
export async function searchTitle(
	title: string,
	mediaType: string | null,
	year: string | null,
	locale: string,
): Promise<TMDBMovie | null> {
	const query = `search/${mediaType ?? "multi"}?query=${encodeURIComponent(title)}&include_adult=false&language=${locale}&page=1`
	const data = await tmdb<TMDBResponse>(year ? `${query}&year=${year}` : query)
	if (!data || isLookupError(data)) return null
	const results = data.results?.filter((item) => item.media_type?.toLowerCase() !== "person")
	const movie = pickBestMatch(results, title)
	return movie?.id ? movie : null
}

// start downloading the likely Letterboxd page while TMDb is searching; it's verified against TMDb's answer before use
export function prefetchLetterboxd(title: string, friends: boolean) {
	Promise.resolve(sendMessage("letterboxdPrefetch", { title, friends }, "background")).catch(() => {})
}

async function imdbIdFor(mediaType: string, tmdbId: number): Promise<string | null | LookupError> {
	const ids = await tmdb<{ imdb_id?: string }>(`${mediaType}/${tmdbId}/external_ids`)
	if (isLookupError(ids)) return ids
	return ids?.imdb_id || null
}

// Films: Letterboxd. TV, and films Letterboxd has no rating for yet: IMDb. The rating-source setting can drop either.
// transient: a provider failed for a moment, so the result mustn't be cached
export async function getExternalRating(
	tmdbId: number,
	mediaType: string,
	title: string,
	sources: RatingSources,
	friends: boolean,
): Promise<{ rating: ExternalRating | null; transient: boolean }> {
	let transient = false
	try {
		// Letterboxd's /tmdb/{id} only understands movie ids, a TV id would resolve to an unrelated film
		if (mediaType === "movie" && usesSource(sources, "letterboxd")) {
			const letterboxd = await sendMessage("letterboxdRating", { tmdbId, friends, title }, "background")
			if (isLookupError(letterboxd)) transient = true
			else if (letterboxd?.rating) return { rating: letterboxd, transient: !!letterboxd.friends_unavailable }
		}
		if (!usesSource(sources, "imdb") || (mediaType !== "movie" && mediaType !== "tv"))
			return { rating: null, transient }
		const imdbId = await imdbIdFor(mediaType, tmdbId)
		if (isLookupError(imdbId)) return { rating: null, transient: true }
		if (!imdbId) return { rating: null, transient }
		const imdb = await sendMessage("imdbRating", { imdbId }, "background")
		if (isLookupError(imdb)) return { rating: null, transient: true }
		return { rating: imdb, transient }
	} catch (error) {
		logLookupFailure("getExternalRating failed", error, tmdbId, mediaType)
		return { rating: null, transient: true }
	}
}

// A show's last episode gets the pill when Letterboxd has a page for the show, which it only has for limited series.
// TMDb's episode counts decide, even on Netflix, which marks the newest episode of a weekly release as its last.
export async function findSeriesFinale(
	{ show, season, episode }: PlayingEpisode,
	friends: boolean,
	locale: string,
): Promise<{ match: TMDBMovie; letterboxd: LetterboxdFilm } | null> {
	const match = await searchTitle(show, "tv", null, locale)
	if (!match) return null
	const details = await tmdb<TvDetails>(`tv/${match.id}?append_to_response=external_ids`)
	if (!details || isLookupError(details) || !isLastEpisode(details.seasons, season, episode)) return null
	const imdbId = details.external_ids?.imdb_id
	if (!imdbId) return null
	const letterboxd = await sendMessage("letterboxdSeries", { imdbId, friends }, "background")
	if (!letterboxd || isLookupError(letterboxd)) return null
	return { match, letterboxd }
}

// IMDb's ratings for each episode of a season; throws when they can't be had
export async function fetchEpisodeRatings(
	show: { id: number; rating_url?: string },
	season: number,
): Promise<ImdbEpisodeRating[]> {
	let imdbId = show.rating_url?.match(/imdb\.com\/title\/(tt\d+)/)?.[1] ?? null
	if (!imdbId) {
		const found = await imdbIdFor("tv", show.id)
		imdbId = isLookupError(found) ? null : found
	}
	if (!imdbId) throw new Error("IMDb series unavailable")
	const result = await sendMessage("imdbEpisodes", { imdbId, season }, "background")
	if (!Array.isArray(result)) throw new Error("Episode ratings unavailable")
	return result
}

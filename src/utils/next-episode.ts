// The next episode's IMDb score for the credits notice. TMDb finds the show, the background's episode cache supplies
// the season, and both the show and season are kept in memory for the rest of the page's life.
import { fetchEpisodeRatings, searchTitle } from "./lookup"
import type { EpisodeRating } from "./page-features"

const shows = new Map<string, Promise<{ id: number } | null>>()
const seasons = new Map<string, Promise<EpisodeRating[]>>()

// "IMDb 8.7" for the episode after this one in the same season, or null when this is the season's last
export async function nextEpisodeRating(show: string, season: number, episode: number): Promise<string | null> {
	const key = show.trim().toLowerCase()
	if (!key) return null
	let found = shows.get(key)
	if (!found) {
		found = searchTitle(show, "tv", null, document.documentElement.lang || navigator.language || "en-US").catch(
			() => null,
		)
		shows.set(key, found)
	}
	const match = await found
	if (!match) {
		shows.delete(key)
		return null
	}
	const seasonKey = `${match.id}|${season}`
	let ratings = seasons.get(seasonKey)
	if (!ratings) {
		ratings = fetchEpisodeRatings({ id: match.id }, season)
		seasons.set(seasonKey, ratings)
	}
	const list = await ratings.catch(() => null)
	if (!list) {
		seasons.delete(seasonKey)
		return null
	}
	const next = list.find((item) => item.episode === episode + 1)
	return next?.rating ? `IMDb ${next.rating.toFixed(1)}` : null
}

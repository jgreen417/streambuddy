// The review pill shows at the end of a film, or at the end of the last episode of a limited series: Letterboxd lists
// limited series as films, and has no page for ongoing shows.

export type PlayingEpisode = { show: string; season: number; episode: number }

const SEASON = String.raw`(?:Season|Staffel|Saison|Temporada|Stagione|Seizoen)`
const EPISODE = String.raw`(?:Ep\.?|Episode|Épisode|Ép\.?|Episodio|Folge|Flg\.?|Aflevering|Afl\.?)`
const LABELS = [
	/\bS(\d+)\s*:?\s*E(\d+)\b/i,
	new RegExp(String.raw`${SEASON}\s+(\d+)\s*[,:.]?\s*${EPISODE}\s*(\d+)`, "i"),
]
// "S1 E8:", "S1:E8", "Season 1, Ep. 10", "Staffel 2, Flg. 5", as the players label the episode playing
export function parseEpisodeLabel(text: string | null | undefined) {
	for (const label of LABELS) {
		const match = label.exec(text ?? "")
		if (match) return { season: Number(match[1]), episode: Number(match[2]) }
	}
	return null
}

type TmdbSeason = { season_number?: number; episode_count?: number }
// TMDb's details for a show: is this the last episode of its last season? Season 0 holds specials.
export function isLastEpisode(seasons: TmdbSeason[] | undefined, season: number, episode: number) {
	const numbered = (seasons ?? []).filter((item) => (item.season_number ?? 0) > 0 && (item.episode_count ?? 0) > 0)
	if (!numbered.length) return false
	const last = numbered.reduce((pick, item) => (item.season_number! > pick.season_number! ? item : pick))
	return season === last.season_number && episode === last.episode_count
}

// shares one lookup per key between callers, but forgets a failed or empty one so the next try asks again
export function shareLookup<T>(
	lookups: Map<string, Promise<T | null>>,
	key: string,
	find: () => Promise<T | null>,
): Promise<T | null> {
	let lookup = lookups.get(key)
	if (!lookup) {
		lookup = find().then(
			(found) => {
				if (!found) lookups.delete(key)
				return found
			},
			(error) => {
				lookups.delete(key)
				throw error
			},
		)
		lookups.set(key, lookup)
	}
	return lookup
}

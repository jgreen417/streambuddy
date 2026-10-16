// The review pill shows at the end of a film, or at the end of the last episode of a limited series: Letterboxd lists
// limited series as films, and has no page for ongoing shows.

export type PlayingEpisode = { show: string; season: number; episode: number; last?: boolean }

// "S1 E8:", "S1:E8", "Season 1, Ep. 10", "Season 1 Episode 3", as the players label the episode playing
export function parseEpisodeLabel(text: string | null | undefined) {
	const match =
		/\bS(\d+)\s*:?\s*E(\d+)\b/i.exec(text ?? "") ??
		/\bSeason\s+(\d+)\s*[,:.]?\s*(?:Ep\.?|Episode)\s*(\d+)/i.exec(text ?? "")
	return match ? { season: Number(match[1]), episode: Number(match[2]) } : null
}

type TmdbSeason = { season_number?: number; episode_count?: number }
// TMDb's details for a show: is this the last episode of its last season? Season 0 holds specials.
export function isLastEpisode(seasons: TmdbSeason[] | undefined, season: number, episode: number) {
	const numbered = (seasons ?? []).filter((item) => (item.season_number ?? 0) > 0 && (item.episode_count ?? 0) > 0)
	if (!numbered.length) return false
	const last = numbered.reduce((pick, item) => (item.season_number! > pick.season_number! ? item : pick))
	return season === last.season_number && episode === last.episode_count
}

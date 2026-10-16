import { describe, expect, it } from "vitest"
import { isLastEpisode, parseEpisodeLabel } from "../../utils/series-finale"

describe("series finales", () => {
	it("reads the episode playing from each player's label", () => {
		expect(parseEpisodeLabel("S1 E8:")).toEqual({ season: 1, episode: 8 })
		expect(parseEpisodeLabel("S2:E10")).toEqual({ season: 2, episode: 10 })
		expect(parseEpisodeLabel("Season 1, Ep. 10 Track 10: Rock 'n' Roll Suicide")).toEqual({ season: 1, episode: 10 })
		expect(parseEpisodeLabel("Season 3 Episode 4")).toEqual({ season: 3, episode: 4 })
		expect(parseEpisodeLabel("Past Lives")).toBeNull()
		expect(parseEpisodeLabel(undefined)).toBeNull()
	})
	it("knows the last episode of the last season, ignoring specials", () => {
		const seasons = [
			{ season_number: 0, episode_count: 3 },
			{ season_number: 1, episode_count: 8 },
		]
		expect(isLastEpisode(seasons, 1, 8)).toBe(true)
		expect(isLastEpisode(seasons, 1, 7)).toBe(false)
		expect(isLastEpisode(seasons, 0, 3)).toBe(false)
		expect(
			isLastEpisode(
				[
					{ season_number: 1, episode_count: 8 },
					{ season_number: 2, episode_count: 9 },
				],
				1,
				8,
			),
		).toBe(false)
		expect(isLastEpisode([], 1, 1)).toBe(false)
		expect(isLastEpisode(undefined, 1, 1)).toBe(false)
	})
})

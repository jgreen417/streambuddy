import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchImdbEpisodes } from "../../utils/ratings"

describe("IMDb episode lookups", () => {
	afterEach(() => vi.unstubAllGlobals())
	it("uses explicit episode numbers, excludes specials and follows pagination", async () => {
		const response = (episode: number, more: boolean) => ({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					title: {
						episodes: {
							episodes: {
								edges: [
									{
										node: {
											id: `tt${episode + 10}`,
											titleText: { text: `Episode ${episode}` },
											ratingsSummary: { aggregateRating: episode === 0 ? null : 8, voteCount: 100 },
											series: { episodeNumber: { seasonNumber: 1, episodeNumber: episode } },
										},
									},
								],
								pageInfo: { hasNextPage: more, endCursor: `cursor${episode}` },
							},
						},
					},
				},
			}),
		})
		const fetcher = vi.fn().mockResolvedValueOnce(response(0, true)).mockResolvedValueOnce(response(1, false))
		vi.stubGlobal("fetch", fetcher)
		expect(await fetchImdbEpisodes("tt0944947", 1)).toEqual([
			{ id: "tt11", season: 1, episode: 1, title: "Episode 1", rating: 8, votes: 100 },
		])
		expect(fetcher).toHaveBeenCalledTimes(2)
		expect(JSON.parse(fetcher.mock.calls[1][1].body).query).toContain('after: "cursor0"')
	})
	it("rejects schema errors so an outage is not cached as an empty season", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ errors: [{ message: "Unavailable" }] }) })),
		)
		await expect(fetchImdbEpisodes("tt1", 1)).rejects.toThrow()
	})
})

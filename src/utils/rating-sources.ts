// Everything that differs between the places a score comes from: its scale, where its colour bands fall, and what
// it's called. Anything that colours, ranks, normalises or labels a score reads it from here.
import { scoreScale } from "@/design/tokens"
import type { RatingSource } from "./ratings"
import type { RatingSources } from "@/stores/storeTypes"

type SourceDescriptor = {
	name: string
	// what the credits pill calls this source's number
	scoreLabel: string
	max: number
	// Band edges picked so each colour covers a similar share of what's actually streaming
	// (popular titles on UK Netflix, Prime and HBO Max, Oct 2026): roughly 13/23/24/25/15%.
	bands: number[]
	// the scores the lowest- and highest-rated popular titles get, for ranking scores from different sources together
	floor: number
	ceiling: number
}

// Letterboxd films: median 3.3, only 15% reach 4.0. IMDb TV runs much higher: median 8.0.
const IMDB_BANDS = [7, 7.7, 8.2, 8.6]
export const RATING_SOURCES: Record<RatingSource, SourceDescriptor> = {
	letterboxd: {
		name: "Letterboxd",
		scoreLabel: "Letterboxd average",
		max: 5,
		bands: [2.5, 3, 3.5, 4],
		floor: 1,
		ceiling: 4.7,
	},
	imdb: { name: "IMDb", scoreLabel: "IMDb rating", max: 10, bands: IMDB_BANDS, floor: 5.5, ceiling: 9.5 },
	// TMDb is only the fallback, and out of 10 like IMDb, so it's coloured on IMDb's scale
	tmdb: { name: "TMDb", scoreLabel: "TMDb rating", max: 10, bands: IMDB_BANDS, floor: 5.5, ceiling: 9.5 },
}

// which sources each choice of the rating-sources setting asks, in the order they're tried
export const SOURCE_CHOICES: Record<RatingSources, Exclude<RatingSource, "tmdb">[]> = {
	both: ["letterboxd", "imdb"],
	letterboxd: ["letterboxd"],
	imdb: ["imdb"],
	tmdb: [],
}
export const usesSource = (sources: RatingSources, source: Exclude<RatingSource, "tmdb">) =>
	SOURCE_CHOICES[sources].includes(source)

// red, orange, yellow, light green, green (src/design/tokens.ts)
export const SCORE_COLORS = scoreScale
// 0 = red ... 4 = green
export function getScoreBand(source: RatingSource, rating: number): number {
	const { bands } = RATING_SOURCES[source]
	const band = bands.findIndex((edge) => rating < edge)
	return band == -1 ? bands.length : band
}
export function getScoreColor(source: RatingSource, rating: number): string {
	return SCORE_COLORS[getScoreBand(source, rating)]
}

// on a 0-10 scale, so scores from every source can be compared against one cut-off
export const normalizeScore = (source: RatingSource, rating: number) => (rating * 10) / RATING_SOURCES[source].max

// Rough percentile among popular streaming titles, so Letterboxd (/5) and IMDb (/10) can be ranked together:
// the share of titles below each band edge, and straight lines between them.
const BAND_PERCENTILES = [13, 36, 60, 85]
export function getRatingPercentile(source: RatingSource, rating: number): number {
	const { bands, floor, ceiling } = RATING_SOURCES[source]
	const anchors = [[floor, 0], ...bands.map((edge, i) => [edge, BAND_PERCENTILES[i]]), [ceiling, 100]]
	if (rating <= anchors[0][0]) return 0
	for (let i = 1; i < anchors.length; i++) {
		const [x0, y0] = anchors[i - 1]
		const [x1, y1] = anchors[i]
		if (rating <= x1) return y0 + ((rating - x0) / (x1 - x0)) * (y1 - y0)
	}
	return 100
}

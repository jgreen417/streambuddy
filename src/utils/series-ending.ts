// The last episode of a show that has ended. The review pill's lookup (content-script/credits.ts) finds it a couple of
// minutes before the credits; the playback engine then lets the credits be, and pauses where they start instead of
// letting the service autoplay something else. The engine matches its own video on the duration, like film-over.ts.
export type SeriesEnding = {
	show: string
	duration: number
	// where the credits start, as far as the service says; the end of the video when it doesn't
	creditsAt: number
	// where to rate it when Letterboxd doesn't list the show (Letterboxd's review pill comes up when it does)
	rate?: { label: string; url: string }
}

let ending: SeriesEnding | null = null
export function setSeriesEnding(next: SeriesEnding | null) {
	ending = next
}
export function seriesEnding(duration: number): SeriesEnding | null {
	return ending && ending.duration === duration ? ending : null
}

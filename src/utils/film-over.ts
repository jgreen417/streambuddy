import { SHORTEST_FILM } from "@/utils/credits-review"

// Whether the film is over: the review pill is up and the film is in its credits, or the service has moved on to a
// trailer. The review pill (content-script/credits.ts) records which film it came up for and where; the playback
// engine checks its own video against that on every tick, so the next film gets its speed controls back even in a
// background tab, where the review pill doesn't update.
let ended: { duration: number; at: number } | null = null
export function setFilmEnded(film: { duration: number; at: number } | null) {
	ended = film
}
export function filmOver(video: HTMLVideoElement | null) {
	if (!ended) return false
	// no video, or one still loading: wait until it's known whether it's a trailer
	if (!video || !Number.isFinite(video.duration)) return true
	// the same film: over unless scrubbed back before the credits; another video: over while it's a trailer
	return video.duration === ended.duration ? video.currentTime >= ended.at - 1 : video.duration < SHORTEST_FILM
}

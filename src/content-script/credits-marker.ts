// Where the service itself says the end credits start, as read from its player by page/credits-marker.ts (Prime Video,
// Max and Disney+). Netflix's marker comes from its metadata instead (utils/netflix-credits.ts).
import type { PlayerClock } from "@/utils/credits-review"
import { CREDITS_MESSAGE, CREDITS_REQUEST, PLAYHEAD_MESSAGE, type CreditsMarker } from "@/utils/credits-markers"
import pageScript from "./page/credits-marker.ts?iife"

// the reader has to run in the page itself to see the player's responses, so it goes in as a <script> of its own.
// credits-marker-start.ts puts it in as the page starts loading where it can; this covers the rest.
export function injectCreditsMarkerReader() {
	const script = document.createElement("script")
	script.src = browser.runtime.getURL(pageScript)
	script.onload = () => script.remove()
	document.documentElement.append(script)
}

// the titles the player loaded on this page, newest last, marked or not: it also loads trailers and the next title
const markers: CreditsMarker[] = []
// where Disney+'s player last said it was, and when
let playhead: { position: number; duration: number; at: number } | null = null
export function addCreditsMarker({ creditsFromEnd, duration, title, episode, entity }: CreditsMarker) {
	if (!(Number.isFinite(duration) && duration > 0)) return
	const about = {
		title: typeof title === "string" ? title : undefined,
		episode: typeof episode === "string" ? episode : undefined,
		entity: typeof entity === "string" ? entity : undefined,
	}
	if (creditsFromEnd === undefined) markers.push({ duration, ...about })
	else if (Number.isFinite(creditsFromEnd) && creditsFromEnd > 0 && creditsFromEnd < duration)
		markers.push({ creditsFromEnd, duration, ...about })
}
export function listenForCreditsMarkers() {
	window.addEventListener("message", (event) => {
		if (event.source !== window) return
		if (event.data?.type === PLAYHEAD_MESSAGE) {
			const { position, duration } = event.data
			if (Number.isFinite(position) && Number.isFinite(duration) && duration > 0)
				playhead = { position, duration, at: Date.now() }
			return
		}
		if (event.data?.type === CREDITS_MESSAGE) addCreditsMarker(event.data)
	})
	injectCreditsMarkerReader()
	window.postMessage({ type: CREDITS_REQUEST }, location.origin)
}

// The marker for this video: the video is the title plus any ads stitched in (up to a fifth of its length), so of the
// titles that fit, the one closest to the video's length, newest on a tie. A title the service didn't mark gets none,
// rather than a similar-length title's.
export function markerFor(video: Pick<PlayerClock, "duration">) {
	let best: CreditsMarker | undefined
	for (const marker of markers) {
		if (video.duration < marker.duration - 5 || video.duration > marker.duration * 1.2) continue
		if (!best || Math.abs(video.duration - marker.duration) <= Math.abs(video.duration - best.duration)) best = marker
	}
	return best
}
// Disney+'s marker for the title on this player page: the one its playback response named, else (before that's in) one of
// the exact length that no other page claims. The next title is loaded before it plays, often with the same length.
export function markerForEntity(entity: string | null, duration: number) {
	const named = entity ? markers.findLast((marker) => marker.entity === entity) : undefined
	return named ?? markers.findLast((marker) => marker.entity === undefined && Math.abs(marker.duration - duration) < 2)
}
export const markedCreditsFromEnd = (video: PlayerClock) => markerFor(video)?.creditsFromEnd

// Disney+'s player position, while the page is still posting it
export function pagePlayhead() {
	return playhead && Date.now() - playhead.at < 3000 ? playhead : null
}

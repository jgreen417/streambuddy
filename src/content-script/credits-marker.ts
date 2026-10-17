// Where the service itself says the end credits start, as read from its player by page/credits-marker.ts (Prime Video
// and Max). Netflix's marker comes from its metadata instead (utils/netflix-credits.ts).
import { CREDITS_MESSAGE, CREDITS_REQUEST, type CreditsMarker } from "@/utils/credits-markers"
import pageScript from "./page/credits-marker.ts?iife"

// the reader has to run in the page itself to see the player's responses, so it goes in as a <script> of its own.
// credits-marker-start.ts puts it in as the page starts loading where it can; this covers the rest.
export function injectCreditsMarkerReader() {
	const script = document.createElement("script")
	script.src = browser.runtime.getURL(pageScript)
	script.onload = () => script.remove()
	document.documentElement.append(script)
}

// the markers seen on this page, newest last: the player also loads trailers and the next title
const markers: CreditsMarker[] = []
export function listenForCreditsMarkers() {
	window.addEventListener("message", (event) => {
		if (event.source !== window || event.data?.type !== CREDITS_MESSAGE) return
		const { creditsFromEnd, duration } = event.data
		if (Number.isFinite(creditsFromEnd) && Number.isFinite(duration) && creditsFromEnd > 0 && creditsFromEnd < duration)
			markers.push({ creditsFromEnd, duration })
	})
	injectCreditsMarkerReader()
	window.postMessage({ type: CREDITS_REQUEST }, location.origin)
}

// The marker for this video: the video is the title plus any ads stitched in (up to a fifth of its length), so of the
// markers that fit, the one for the title closest to the video's length.
export function markedCreditsFromEnd(video: HTMLVideoElement) {
	let best: CreditsMarker | undefined
	for (const marker of markers) {
		if (video.duration < marker.duration - 5 || video.duration > marker.duration * 1.2) continue
		if (!best || Math.abs(video.duration - marker.duration) <= Math.abs(video.duration - best.duration)) best = marker
	}
	return best?.creditsFromEnd
}

// Where the service itself says the end credits start, as read from its player by page/credits-marker.ts (Prime Video
// and Max). Netflix's marker comes from its metadata instead (utils/netflix-credits.ts).
import { CREDITS_MESSAGE, type CreditsMarker } from "@/utils/credits-markers"
import pageScript from "./page/credits-marker.ts?iife"

let latest: CreditsMarker | undefined
// the reader has to run in the page itself to see the player's responses, so it goes in as a <script> of its own
export function listenForCreditsMarkers() {
	const script = document.createElement("script")
	script.src = browser.runtime.getURL(pageScript)
	script.onload = () => script.remove()
	document.documentElement.append(script)
	window.addEventListener("message", (event) => {
		if (event.source !== window || event.data?.type !== CREDITS_MESSAGE) return
		const { creditsFromEnd, duration } = event.data
		if (typeof creditsFromEnd === "number" && typeof duration === "number") latest = { creditsFromEnd, duration }
	})
}

// the latest marker, if it belongs to this video: the video is the title plus any ads stitched in (up to a fifth of
// its length), so a trailer or the previous title's marker isn't used
export function markedCreditsFromEnd(video: HTMLVideoElement) {
	if (!latest || video.duration < latest.duration - 5 || video.duration > latest.duration * 1.2) return undefined
	return latest.creditsFromEnd
}

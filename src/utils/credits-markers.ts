// Where Max and Prime Video mark the end credits in their players' playback responses, as read by
// content-script/page/credits-marker.ts. Anything unexpected counts as "no marker".
// the message the page script posts each marker in
export const CREDITS_MESSAGE = "streambuddy:credits-marker"
// the content script asking the page script for the markers it found before the content script was listening
export const CREDITS_REQUEST = "streambuddy:credits-marker-request"

// a title the player loaded, with its credits when the service marks them
export type CreditsMarker = {
	// seconds of credits up to the end of the title
	creditsFromEnd?: number
	// the title's own length in seconds, without ads
	duration: number
}

type MaxPlayback = {
	videos?: { type?: unknown; duration?: unknown; annotations?: { type?: unknown; start?: unknown }[] }[]
}
type PrimePlayback = {
	transitionTimecodes?: { result?: { events?: { eventType?: unknown; startTimeMs?: unknown }[] } }
	vodPlaylistedPlaybackUrls?: { result?: { playbackUrls?: { fullTitleDurationMs?: unknown } } }
}

function marker(start: unknown, duration: unknown): CreditsMarker | undefined {
	if (typeof duration !== "number" || !(duration > 0)) return undefined
	if (typeof start !== "number" || !(start > 0 && start < duration)) return { duration }
	return { creditsFromEnd: duration - start, duration }
}

// Max plays a playlist (promos, then the title) in one <video>, with ads stitched in before the credits. The marker is
// in seconds on the playlist's timeline without ads, so it's measured back from the end of the title, which is where
// the <video> ends too.
export function maxCreditsMarker(json: MaxPlayback) {
	const videos = json.videos ?? []
	const main = videos.findIndex((video) => video.type === "main")
	if (main < 0) return undefined
	const titleEnd = videos
		.slice(0, main + 1)
		.reduce((sum, video) => sum + (typeof video.duration === "number" ? video.duration : Number.NaN), 0)
	const credits = videos[main].annotations?.find((annotation) => annotation.type === "end-credits")
	return marker(credits?.start, titleEnd)
}
export function primeCreditsMarker(json: PrimePlayback) {
	const credits = json.transitionTimecodes?.result?.events?.find((event) => event.eventType === "END_CREDITS")
	const duration = json.vodPlaylistedPlaybackUrls?.result?.playbackUrls?.fullTitleDurationMs
	const found = marker(credits?.startTimeMs, duration)
	if (!found) return undefined
	return found.creditsFromEnd === undefined
		? { duration: found.duration / 1000 }
		: { creditsFromEnd: found.creditsFromEnd / 1000, duration: found.duration / 1000 }
}

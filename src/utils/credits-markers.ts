// Where Max, Prime Video and Disney+ mark the end credits in their players' playback responses, as read by
// content-script/page/credits-marker.ts. Anything unexpected counts as "no marker".
// the message the page script posts each marker in
export const CREDITS_MESSAGE = "streambuddy:credits-marker"
// the content script asking the page script for the markers it found before the content script was listening
export const CREDITS_REQUEST = "streambuddy:credits-marker-request"
// where Disney+'s player is in the title, posted by the page script every second while it plays
export const PLAYHEAD_MESSAGE = "streambuddy:playhead"

// a title the player loaded, with its credits when the service marks them
export type CreditsMarker = {
	// seconds of credits up to the end of the title
	creditsFromEnd?: number
	// the title's own length in seconds, without ads
	duration: number
	// what's playing, where the response says (Disney+): its title, and an episode's "S1:E1 Simpsons Roasting…"
	title?: string
	episode?: string
	// the player page it's for (Disney+'s /play/<entity>), once the title has started playing
	entity?: string
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

type DisneyExperience = {
	data?: {
		playerExperience?: {
			timeline?: { runtimeMs?: unknown }
			title?: unknown
			subtitle?: unknown
			analytics?: { programType?: unknown }
		}
	}
}
type DisneyPlayback = {
	stream?: {
		editorial?: { label?: unknown; offsetMillis?: unknown }[]
		playbackRights?: { externalIds?: { availId?: unknown } }
	}
	tracking?: { qoe?: { entityId?: unknown } }
}
// Disney+ splits it over two responses for the same title (its availId): the player experience has the runtime and
// what's playing, the playback response the editorial markers, FFEC being the first frame of the end credits. Each
// reader gives the title's marker once its player experience is in, with the credits once both are.
export function disneyCreditsMarkers() {
	const titles = new Map<string, CreditsMarker>()
	const credits = new Map<string, number>()
	const entities = new Map<string, string>()
	const markerFor = (id: string) => {
		const title = titles.get(id)
		if (!title) return undefined
		const found = marker(credits.get(id), title.duration)
		return found && { ...title, ...found, entity: entities.get(id) }
	}
	return {
		experience(json: DisneyExperience, url: string) {
			const id = /\/playerExperience\/([^/?#]+)/.exec(url)?.[1]
			const experience = json.data?.playerExperience
			const runtime = experience?.timeline?.runtimeMs
			if (!id || typeof runtime !== "number" || !(runtime > 0)) return undefined
			const { title, subtitle } = experience ?? {}
			titles.set(id, {
				duration: runtime / 1000,
				title: typeof title === "string" ? title : undefined,
				episode:
					experience?.analytics?.programType === "episode" ? (typeof subtitle === "string" ? subtitle : "") : undefined,
			})
			return markerFor(id)
		},
		playback(json: DisneyPlayback) {
			const id = json.stream?.playbackRights?.externalIds?.availId
			const start = json.stream?.editorial?.find((mark) => mark.label === "FFEC")?.offsetMillis
			const entity = json.tracking?.qoe?.entityId
			if (typeof id !== "string") return undefined
			if (typeof entity === "string") entities.set(id, entity)
			if (typeof start === "number") credits.set(id, start / 1000)
			else if (typeof entity !== "string") return undefined
			return markerFor(id)
		},
	}
}

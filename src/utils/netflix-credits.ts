// Netflix's own metadata says when a title's credits start: its end screen comes up at that moment. The field is
// undocumented, so anything unexpected counts as "no marker" and the caller falls back to guessing from the runtime.
export type NetflixCredits = {
	title: string
	movie: boolean
	// the share of the runtime the credits take, when Netflix marks them
	creditsShare?: number
}

type Metadata = { video?: { title?: unknown; type?: unknown; creditsOffset?: unknown; runtime?: unknown } }

export function parseNetflixCredits(json: unknown): NetflixCredits | null {
	const video = (json as Metadata | null)?.video
	if (!video || typeof video.title !== "string") return null
	const movie = video.type === "movie"
	const { creditsOffset: offset, runtime } = video
	// a film with no marker has creditsOffset == runtime. Measured as a share of the runtime, so it doesn't matter
	// whether Netflix gives seconds or milliseconds.
	const marked = typeof offset === "number" && typeof runtime === "number" && offset > 0 && offset < runtime
	return {
		title: video.title,
		movie,
		creditsShare: marked && movie ? 1 - offset / runtime : undefined,
	}
}

const cache = new Map<string, Promise<unknown>>()

// the metadata for /watch/{id}, fetched once per title with the viewer's own Netflix session
export function fetchNetflixMetadata(watchId: string) {
	let pending = cache.get(watchId)
	if (!pending) {
		pending = fetch(`${location.origin}/nq/website/memberapi/release/metadata?movieid=${encodeURIComponent(watchId)}`, {
			credentials: "include",
		})
			.then((response) => (response.ok ? response.json() : null))
			.catch(() => null)
		cache.set(watchId, pending)
	}
	return pending
}

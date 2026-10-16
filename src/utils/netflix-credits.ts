// Netflix's own metadata says when a title's credits start: its end screen comes up at that moment. The field is
// undocumented, so anything unexpected counts as "no marker" and the caller falls back to guessing from the runtime.
export type NetflixCredits = {
	title: string
	movie: boolean
	// the share of the runtime the credits take, when Netflix marks them
	creditsShare?: number
	// for an episode: where it sits in the show, and whether it's the last one Netflix has
	episode?: { season: number; number: number; last: boolean }
}

type Marked = { creditsOffset?: unknown; runtime?: unknown }
type Episode = Marked & { id?: unknown; episodeId?: unknown; seq?: unknown }
type Metadata = {
	video?: Marked & {
		title?: unknown
		type?: unknown
		// asked about by an episode's id, Netflix answers with the whole show and says which episode that was
		currentEpisode?: unknown
		seasons?: Array<{ seq?: unknown; episodes?: Episode[] }>
	}
}

// a title with no marker has creditsOffset == runtime. Measured as a share of the runtime, so it doesn't matter
// whether Netflix gives seconds or milliseconds.
function creditsShare({ creditsOffset: offset, runtime }: Marked) {
	const marked = typeof offset === "number" && typeof runtime === "number" && offset > 0 && offset < runtime
	return marked ? 1 - offset / runtime : undefined
}

export function parseNetflixCredits(json: unknown): NetflixCredits | null {
	const video = (json as Metadata | null)?.video
	if (!video || typeof video.title !== "string") return null
	const movie = video.type === "movie"
	if (movie) return { title: video.title, movie, creditsShare: creditsShare(video) }
	const seasons = Array.isArray(video.seasons) ? video.seasons : []
	const playing = video.currentEpisode
	for (const [s, season] of seasons.entries()) {
		const episodes = Array.isArray(season.episodes) ? season.episodes : []
		const index = episodes.findIndex(
			(episode) => playing != null && String(episode.id ?? episode.episodeId) === String(playing),
		)
		if (index < 0 || typeof season.seq !== "number") continue
		const episode = episodes[index]
		return {
			title: video.title,
			movie,
			creditsShare: creditsShare(episode),
			episode: {
				season: season.seq,
				number: typeof episode.seq === "number" ? episode.seq : index + 1,
				last: s === seasons.length - 1 && index === episodes.length - 1,
			},
		}
	}
	return { title: video.title, movie }
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

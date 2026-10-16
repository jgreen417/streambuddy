import { logLookupFailure } from "@/utils/log"
// Netflix's episode cards ("Super Buzzy Pilot Episodes") are labelled with the episode name and show the series
// only as a logo, so the series title comes from Netflix's own pathEvaluator: videos[episode].ancestor.title.
const PATH_EVALUATOR = "/nq/website/memberapi/release/pathEvaluator?original_path=%2Fshakti%2Fmre%2FpathEvaluator"
const BATCH_DELAY_MS = 50

type Atom<T> = { $type: "atom"; value: T }
type Ref = { $type: "ref"; value: [string, string] }
type JsonGraph = { videos?: Record<string, { title?: Atom<string>; ancestor?: Ref }> }

// The show title for each episode id in a pathEvaluator response; ids without an ancestor map to null.
export function parseShowTitles(ids: string[], graph: JsonGraph | undefined): Map<string, string | null> {
	const videos = graph?.videos ?? {}
	return new Map(
		ids.map((id) => {
			const showId = videos[id]?.ancestor?.value?.[1]
			return [id, (showId && videos[showId]?.title?.value) || null]
		}),
	)
}

export function getEpisodeId(href: string | null): string | null {
	return href?.match(/[?&]jbv=(\d+)/)?.[1] ?? null
}

// Firefox sends a content script's own fetch as the extension, which Netflix refuses; content.fetch goes as the page.
// Chrome's content-script fetch already goes as the page.
const pageFetch: typeof fetch = (...args) =>
	((globalThis as { content?: { fetch?: typeof fetch } }).content?.fetch ?? fetch)(...args)

export class NetflixShowTitles {
	// undefined: not asked yet, null: asked and Netflix has no show for it
	private titles = new Map<string, string | null>()
	private queued = new Set<string>()
	private inFlight = new Set<string>()
	private timer: ReturnType<typeof setTimeout> | undefined

	constructor(private fetcher: typeof fetch = pageFetch) {}

	// The cached title, or undefined while it's being looked up (callers retry on their next pass)
	get(id: string): string | null | undefined {
		if (this.titles.has(id)) return this.titles.get(id)
		if (this.inFlight.has(id)) return undefined
		this.queued.add(id)
		this.timer ??= setTimeout(() => this.flush(), BATCH_DELAY_MS)
		return undefined
	}

	private async flush() {
		this.timer = undefined
		const ids = [...this.queued]
		this.queued.clear()
		for (const id of ids) this.inFlight.add(id)
		let titles = new Map<string, string | null>()
		try {
			const response = await this.fetcher(`${location.origin}${PATH_EVALUATOR}`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "path=" + encodeURIComponent(JSON.stringify(["videos", ids.map(Number), "ancestor", "title"])),
			})
			if (!response.ok) throw new Error(`pathEvaluator ${response.status}`)
			titles = parseShowTitles(ids, (await response.json()).jsonGraph)
		} catch (error) {
			logLookupFailure("Netflix show lookup failed:", error)
		}
		// anything Netflix didn't answer for stays null (unrated) rather than retrying on every pass
		for (const id of ids) {
			this.titles.set(id, titles.get(id) ?? null)
			this.inFlight.delete(id)
		}
	}
}

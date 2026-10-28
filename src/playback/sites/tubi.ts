import type { SiteAdapter } from "../types"
import { $ } from "./dom"
import { parseEpisodeLabel } from "@/utils/series-finale"

// A film plays on its own title page (/movies/<id>/<slug>), an episode on its page (/tv-shows/<id>/s01-e01-…)
const playingId = () => /^\/(?:movies|tv-shows)\/(\d+)(?:\/|$)/.exec(location.pathname)?.[1] ?? null

// What Tubi's page data says about a title: where its credits start and where its ad breaks fall, in seconds
export type TubiTitle = { postlude?: number; adBreaks: number[] }

// The page's data is a script, window.__data = {…}, written as JSON except for bare undefined values
export function parseTubiTitle(html: string, id: string): TubiTitle | null {
	const start = /window\.__data\s*=\s*\{/.exec(html)
	if (!start) return null
	const from = start.index + start[0].length - 1
	const to = objectEnd(html, from)
	if (to < 0) return null
	const body = html.slice(from, to).replace(/(?<=[:,[])\s*undefined\s*(?=[,}\]])/g, "null")
	let data: { video?: { byId?: Record<string, TubiVideo> } }
	try {
		data = JSON.parse(body)
	} catch {
		return null
	}
	const video = data.video?.byId?.[id]
	if (!video) return null
	const postlude = video.credit_cuepoints?.postlude
	return {
		postlude: typeof postlude === "number" && postlude > 0 ? postlude : undefined,
		adBreaks: (video.monetization?.cue_points ?? []).filter((at) => typeof at === "number" && at > 0),
	}
}

// just past the brace that closes the object opening at from, so a statement after it in the same script is left out
function objectEnd(text: string, from: number) {
	let depth = 0
	let inString = false
	for (let at = from; at < text.length; at++) {
		const char = text[at]
		if (inString) {
			if (char === "\\") at++
			else if (char === '"') inString = false
		} else if (char === '"') inString = true
		else if (char === "{") depth++
		else if (char === "}" && --depth === 0) return at + 1
	}
	return -1
}
type TubiVideo = { credit_cuepoints?: { postlude?: number }; monetization?: { cue_points?: number[] } }

// each title's data once read, else how many reads have failed and when to try again
const titles = new Map<string, TubiTitle | { failures: number; retryAt: number }>()
const RETRY_MS = 30_000
const TRIES = 2

// The script the page was loaded with holds the first title and its season's other episodes; once Tubi has moved on
// to a title it doesn't hold, the page is fetched again for that title's own data, once more if that fails, then
// the title goes without (the ad itself is still cut short)
export function playingTubiTitle(): TubiTitle | undefined {
	const id = playingId()
	if (!id) return undefined
	const known = titles.get(id)
	if (known && "adBreaks" in known) return known
	if (known && Date.now() < known.retryAt) return undefined
	const script = Array.from(document.scripts).find((element) => element.text.includes("window.__data"))
	const inline = script && parseTubiTitle(script.text, id)
	if (inline) {
		titles.set(id, inline)
		return inline
	}
	const failures = (known?.failures ?? 0) + 1
	const failed = () =>
		titles.set(id, failures < TRIES ? { failures, retryAt: Date.now() + RETRY_MS } : { adBreaks: [] })
	titles.set(id, { failures, retryAt: Infinity })
	fetch(location.pathname)
		.then(async (response) => {
			const title = response.ok ? parseTubiTitle(await response.text(), id) : null
			if (title) titles.set(id, title)
			else failed()
		})
		.catch(failed)
	return undefined
}

const adVideo = () => $<HTMLVideoElement>('[data-id="adComponent"] video')
// "S01:E01 - The Man Who Was Death", the heading above an episode's player
const episodeLabel = () =>
	location.pathname.startsWith("/tv-shows/")
		? (Array.from(document.querySelectorAll("h2"), (heading) => parseEpisodeLabel(heading.textContent)).find(Boolean) ??
			null)
		: null

export const tubi: SiteAdapter = {
	service: "Tubi",
	video: () => (playingId() ? $<HTMLVideoElement>('[data-id="hls"] > video[data-id="videoPlayerComponent"]') : null),
	// the box holding the video and the controls drawn over it
	playerRoot: () => $('[data-id="hls"]')?.parentElement?.parentElement ?? null,
	// no skip buttons: Tubi's next-up countdown is a few seconds after an episode's credits, and the review pill comes
	// up in a film's
	skipButton: () => null,
	// an ad plays in a <video> of its own while the title's waits, hidden, at the break; it shows no time left
	adRemaining() {
		const ad = adVideo()
		return ad && Number.isFinite(ad.duration) && !ad.ended ? ad.duration - ad.currentTime : null
	},
	adVideo,
	adStrategy: "seek",
	// Tubi plays no ad for a break the title is seeked past
	adBreaks: () => playingTubiTitle()?.adBreaks ?? [],
	episodeKey: playingId,
	episodeNumber: () => episodeLabel()?.episode ?? null,
	episodeSeason: () => episodeLabel()?.season ?? null,
	// the title is a logo; the page's hidden h1 names the film, or the show on an episode's page
	showTitle: () => $("h1")?.textContent?.trim() || null,
}

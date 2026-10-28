import type { SiteAdapter } from "../types"
import { $ } from "./dom"
import { parseEpisodeLabel } from "@/utils/series-finale"

// A film plays on its own title page (/movies/<id>/<slug>), an episode on its page (/tv-shows/<id>/s01-e01-…)
const playingId = () => /^\/(?:movies|tv-shows)\/(\d+)(?:\/|$)/.exec(location.pathname)?.[1] ?? null

// What Tubi's page data says about a title: where its credits start and where its ad breaks fall, in seconds
export type TubiTitle = { postlude?: number; adBreaks: number[] }

// The page's data is a script, window.__data = {…}, written as JSON except for bare undefined values
export function parseTubiTitle(html: string, id: string): TubiTitle | null {
	const start = html.indexOf("window.__data=")
	if (start < 0) return null
	const end = html.indexOf("</script>", start)
	const body = html
		.slice(start + "window.__data=".length, end < 0 ? undefined : end)
		.trim()
		.replace(/;$/, "")
		.replace(/(?<=[:,[])undefined(?=[,}\]])/g, "null")
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
type TubiVideo = { credit_cuepoints?: { postlude?: number }; monetization?: { cue_points?: number[] } }

// each title's data once read, else when it may be asked for again (a failed fetch waits a while)
const titles = new Map<string, TubiTitle | number>()
const RETRY_MS = 30_000

// The script the page was loaded with holds the first title and its season's other episodes; once Tubi has moved on
// to a title it doesn't hold, the page is fetched again for that title's own data
export function playingTubiTitle(): TubiTitle | undefined {
	const id = playingId()
	if (!id) return undefined
	const known = titles.get(id)
	if (typeof known === "object") return known
	if (known !== undefined && Date.now() < known) return undefined
	const script = Array.from(document.scripts).find((element) => element.text.startsWith("window.__data="))
	const inline = script && parseTubiTitle(script.text, id)
	if (inline) {
		titles.set(id, inline)
		return inline
	}
	titles.set(id, Date.now() + RETRY_MS)
	fetch(location.pathname)
		.then(async (response) => {
			// a page that loaded but doesn't hold the title won't on a later try either
			if (response.ok) titles.set(id, parseTubiTitle(await response.text(), id) ?? { adBreaks: [] })
		})
		.catch(() => {})
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

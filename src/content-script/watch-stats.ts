// The numbers behind the popup's Stats tab: time spent watching, and the best-rated titles shown on cards
import {
	addWatchSeconds,
	mergeSeenTitles,
	type SeenTitle,
	type SeenTop,
	type WatchLog,
	type WatchTimerState,
	watchTick,
} from "@/utils/stats"
import { SERVICES } from "@/constants/streamingServices"
import type { RatingsSite } from "./sites/types"

// Watch time only counts on player pages while the video is actually advancing,
// so autoplaying previews on the browse pages and paused players don't add up.
const WATCH_TICK_SECONDS = 15
const watchState: WatchTimerState = { pendingSeconds: 0, lastVideoTime: -1 }
function getPlayingVideo() {
	let best: HTMLVideoElement | undefined
	for (const video of Array.from(document.querySelectorAll("video"))) {
		if (video.paused || video.ended || video.readyState < 3) continue
		if (!best || video.clientWidth * video.clientHeight > best.clientWidth * best.clientHeight) best = video
	}
	return best
}
export function startWatchTimer(service: RatingsSite) {
	const platform = SERVICES[service.service].statsKey
	// saved every tick rather than in batches: a tab closed mid-batch used to lose up to a minute,
	// and pagehide can't be relied on to finish an async storage write
	setInterval(() => {
		const video = service.isPlayerPage() ? getPlayingVideo() : undefined
		watchTick(watchState, video?.currentTime, WATCH_TICK_SECONDS)
		flushWatchTime(platform)
	}, WATCH_TICK_SECONDS * 1000)
	globalThis.addEventListener("pagehide", () => flushWatchTime(platform))
}
async function flushWatchTime(platform: string) {
	if (!watchState.pendingSeconds) return
	const seconds = watchState.pendingSeconds
	watchState.pendingSeconds = 0
	const { watchLog } = await browser.storage.local.get("watchLog")
	await browser.storage.local.set({
		watchLog: addWatchSeconds((watchLog as WatchLog) ?? {}, new Date(), platform, seconds),
	})
}

// the best-rated titles shown on cards this week, for the Stats tab
// (films you've already logged on Letterboxd aren't recommendations, so they're left out)
let seenQueue: SeenTitle[] = []
let watchlistQueue: SeenTitle[] = []
let seenFlushTimer: ReturnType<typeof setTimeout> | undefined
export function queueSeenTitle(entry: SeenTitle, personal: { watched: boolean; watchlist: boolean }) {
	if (personal.watched) return
	seenQueue.push(entry)
	if (personal.watchlist) watchlistQueue.push(entry)
	seenFlushTimer ??= setTimeout(flushSeenTitles, 5000)
}
async function flushSeenTitles() {
	const entries = seenQueue
	const watchlistEntries = watchlistQueue
	seenQueue = []
	watchlistQueue = []
	seenFlushTimer = undefined
	const now = new Date()
	const stored = await browser.storage.local.get(["seenTop", "watchlistSeen"])
	await browser.storage.local.set({
		seenTop: mergeSeenTitles((stored.seenTop as SeenTop) ?? {}, entries, now),
		watchlistSeen: mergeSeenTitles((stored.watchlistSeen as SeenTop) ?? {}, watchlistEntries, now),
	})
}

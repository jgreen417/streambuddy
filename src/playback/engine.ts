import { PlayerOverlay, formatRate, formatSaved, type NoticeAction } from "./overlay"
import { isExcepted, loadRules, onRulesChanged, saveRules, withException } from "./rules"
import { SKIP_LABELS, type PlaybackSettings, type SiteAdapter, type SkipKind, type SkipRules } from "./types"
import { addSavedSeconds, type SavedLog } from "@/utils/stats"
import { filmOver } from "@/utils/film-over"

const TICK_MS = 250
const SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const SPEED_STEP = 0.25
const SPEED_MIN = 0.25
const SPEED_MAX = 4
const FAST_FORWARD_RATE = 8
const SKIP_ORDER: SkipKind[] = ["intro", "recap", "credits", "stillWatching"]

// One engine per tab. It watches the site's player through an adapter and does what the viewer asked for:
// skips, passes ads, holds their speed, and pauses long autoplay runs. Every skip is announced and undoable.
export class PlaybackEngine {
	private overlay: PlayerOverlay
	private rules: SkipRules = {}
	private timer: ReturnType<typeof setInterval> | undefined
	private video: HTMLVideoElement | null = null
	private episode: string | null = null
	// per episode: kinds the viewer undid, and when each button was last pressed
	private suppressed = new Set<SkipKind>()
	private lastPress = new Map<SkipKind, number>()
	// when each skip control first appeared, for the optional wait before pressing it
	private firstSeen = new Map<SkipKind, number>()
	// the player only shows the episode number with its controls, so remember an episode 1 once seen
	private premiere = false
	// speed the viewer wants; null until loaded from storage
	private rate: number | null = null
	private renderedRate: number | null = null
	// ad being fast-forwarded: what to restore afterwards
	private adRestore: { muted: boolean } | null = null
	private adAnnounced = false
	private lastSeekedAd = 0
	// autoplay run: episodes started in a row without the viewer touching the page
	private autoplayRun = 0
	private touched = true
	private pendingPause = false
	private pendingSaved: Record<string, number> = {}
	private savedFlush: ReturnType<typeof setTimeout> | undefined

	constructor(
		private site: SiteAdapter,
		private settings: () => PlaybackSettings,
	) {
		this.overlay = new PlayerOverlay(() => site.playerRoot())
	}

	async start() {
		this.rules = await loadRules()
		onRulesChanged((rules) => (this.rules = rules))
		this.rate = await loadRate(this.site.service)
		const touch = (event: Event) => {
			if (event.isTrusted) this.touched = true
		}
		document.addEventListener("pointerdown", touch, true)
		document.addEventListener("keydown", touch, true)
		// on window, in the capture phase, so players that swallow keystrokes don't see these first
		window.addEventListener("keydown", (event) => this.onKey(event), true)
		document.addEventListener("pointermove", () => this.overlay.flashSpeed(), { passive: true })
		document.addEventListener("fullscreenchange", () => this.overlay.attach())
		this.timer = setInterval(() => this.tick(), TICK_MS)
	}
	stop() {
		clearInterval(this.timer)
		this.overlay.detach()
	}

	// runs in background tabs too (browsers slow the timer there), so skips still happen while you listen elsewhere
	private tick() {
		const video = this.site.video()
		if (!video) {
			if (this.video) this.leavePlayer()
			return
		}
		if (video !== this.video) this.enterVideo(video)
		this.overlay.attach()
		this.checkEpisode(video)
		const settings = this.settings()
		this.handleAds(video, settings)
		if (!this.adRestore) this.handleSkips(video, settings)
		this.handleSpeed(settings)
	}

	private enterVideo(video: HTMLVideoElement) {
		this.video = video
		video.addEventListener("ratechange", () => this.onRateChange(video))
		video.addEventListener("loadedmetadata", () => this.applyRate())
		video.addEventListener("playing", () => {
			if (this.pendingPause) this.pauseForRun(video)
		})
		this.applyRate()
	}
	// the episode is kept: players drop the <video> for a moment between autoplayed episodes, and forgetting
	// it would restart the autoplay run on every episode
	private leavePlayer() {
		this.video = null
		this.firstSeen.clear()
		this.overlay.removeSpeed()
		this.overlay.detach()
	}

	// #region episodes and the autoplay pause
	private checkEpisode(video: HTMLVideoElement) {
		const key = this.site.episodeKey()
		if (!key || key === this.episode) return
		const first = this.episode === null
		this.episode = key
		this.suppressed.clear()
		this.lastPress.clear()
		this.firstSeen.clear()
		this.premiere = false
		this.autoplayRun = first || this.touched ? 1 : this.autoplayRun + 1
		this.touched = false
		const limit = this.settings().pauseAfter
		if (limit > 0 && this.autoplayRun > limit) {
			this.pendingPause = true
			if (!video.paused) this.pauseForRun(video)
		}
	}
	private pauseForRun(video: HTMLVideoElement) {
		this.pendingPause = false
		video.pause()
		const watched = this.autoplayRun - 1
		this.overlay.showNotice(
			`Paused after ${watched} episode${watched === 1 ? "" : "s"} in a row`,
			[
				{
					label: "Keep watching",
					run: () => {
						this.autoplayRun = 1
						video.play().catch(() => {})
					},
				},
			],
			60_000,
		)
	}
	// #endregion

	// #region skips
	private handleSkips(video: HTMLVideoElement, settings: PlaybackSettings) {
		const show = this.site.showTitle()
		this.premiere ||= this.site.episodeNumber() === 1
		for (const kind of SKIP_ORDER) {
			if (!settings.skip[kind] || this.suppressed.has(kind) || isExcepted(this.rules, show, kind)) continue
			if (kind === "intro" && settings.keepFirstIntro && this.premiere) continue
			if (kind === "recap" && settings.keepSeasonRecaps && this.premiere) continue
			const button = this.site.skipButton(kind)
			// a control that comes and goes (ads, the end screen) starts its wait again next time it appears
			if (!button || !isShown(button)) {
				this.firstSeen.delete(kind)
				continue
			}
			const now = Date.now()
			if (settings.skipDelaySeconds > 0) {
				const first = this.firstSeen.get(kind) ?? now
				this.firstSeen.set(kind, first)
				if (now - first < settings.skipDelaySeconds * 1000) continue
			}
			if (now - (this.lastPress.get(kind) ?? 0) < 2000) continue
			this.lastPress.set(kind, now)
			this.firstSeen.delete(kind)
			this.press(kind, button, video, show, settings)
			return
		}
	}

	private press(
		kind: SkipKind,
		button: HTMLElement,
		video: HTMLVideoElement,
		show: string | null,
		settings: PlaybackSettings,
	) {
		// the title's own clock where the site has one: Disney+'s <video> has no length and restarts at every jump
		const clock = () => this.site.clock?.() ?? video
		const before = clock().currentTime
		const duration = clock().duration
		const remaining = Number.isFinite(duration) ? duration - before : 0
		button.click()
		if (kind === "stillWatching") {
			if (settings.notices) this.overlay.showNotice("Kept playing")
			return
		}
		const canSeek = !this.site.seekBlocked
		if (kind === "credits") {
			// announce now: the next episode replaces the player, so a notice after it would have nowhere to go
			if (remaining > 1 && remaining < 30 * 60) this.recordSaved(kind, remaining)
			if (settings.notices) this.announceSkip(kind, remaining, show ? [this.notForShow(kind, show)] : [])
			return
		}
		// the jump lands a moment after the click; measure it then (a page-read clock catches up a little later)
		setTimeout(
			() => {
				const saved = this.video === video ? clock().currentTime - before : 0
				if (saved > 1 && saved < 30 * 60) this.recordSaved(kind, saved)
				if (!settings.notices) return
				const actions = []
				if (canSeek && this.video === video)
					actions.push({
						label: "Undo",
						run: () => {
							this.suppressed.add(kind)
							video.currentTime = before
						},
					})
				if (show)
					actions.push(
						this.notForShow(kind, show, () => {
							if (canSeek && this.video === video) video.currentTime = before
						}),
					)
				this.announceSkip(kind, saved, actions)
			},
			this.site.clock ? 2500 : 700,
		)
	}
	private announceSkip(kind: SkipKind, saved: number, actions: NoticeAction[]) {
		const savedText = saved > 1 ? ` · ${formatSaved(saved)} saved` : ""
		this.overlay.showNotice(`Skipped ${SKIP_LABELS[kind]}${savedText}`, actions)
	}
	private notForShow(kind: SkipKind, show: string, undo?: () => void): NoticeAction {
		return {
			label: "Not for this show",
			quiet: true,
			run: () => {
				this.suppressed.add(kind)
				this.rules = withException(this.rules, show, kind)
				saveRules(this.rules).catch(() => {})
				undo?.()
			},
		}
	}
	// #endregion

	// #region ads
	private handleAds(video: HTMLVideoElement, settings: PlaybackSettings) {
		const remaining = settings.skipAds ? (this.site.adRemaining?.() ?? null) : null
		if (remaining === null || remaining <= 0) {
			if (this.adRestore) this.endFastForward(video)
			this.adAnnounced = false
			return
		}
		if (this.site.adStrategy === "seek") {
			// one jump per ad break; the player reports the same break for a moment after the seek
			if (Date.now() - this.lastSeekedAd < 3000) return
			this.lastSeekedAd = Date.now()
			video.currentTime += remaining
			this.recordSaved("ad", remaining)
			if (settings.notices) this.overlay.showNotice(`Skipped ad · ${formatSaved(remaining)} saved`)
			return
		}
		if (!this.adRestore) {
			this.adRestore = { muted: video.muted }
			video.muted = true
			if (video.paused) video.play().catch(() => {})
		}
		this.setRate(video, FAST_FORWARD_RATE)
		if (!this.adAnnounced) {
			this.adAnnounced = true
			// fast playback shortens the break to an eighth; the rest is time saved
			this.recordSaved("ad", remaining * (1 - 1 / FAST_FORWARD_RATE))
			if (settings.notices) this.overlay.showNotice(`Fast-forwarding ad · ${formatSaved(remaining)} left`, [], 3500)
		}
	}
	private endFastForward(video: HTMLVideoElement) {
		video.muted = this.adRestore?.muted ?? false
		this.adRestore = null
		this.applyRate()
	}
	// #endregion

	// #region speed
	// the title's own clock where the site has one (Disney+'s <video> has no length)
	private filmOver() {
		return filmOver(this.site.clock?.() ?? this.video)
	}
	private handleSpeed(settings: PlaybackSettings) {
		if (!settings.speedControl || this.rate === null || this.site.hasNativeSpeedControl?.() || this.filmOver()) {
			this.overlay.removeSpeed()
			return
		}
		if (this.overlay.hasSpeed() && this.renderedRate === this.rate) return
		// the pill coming back after the film was over: the next film picks up the saved speed
		if (!this.overlay.hasSpeed()) this.applyRate()
		this.renderedRate = this.rate
		this.overlay.renderSpeed(this.rate, SPEED_PRESETS, (rate) => this.chooseRate(rate))
	}
	private applyRate() {
		if (!this.video || this.adRestore || this.rate === null || !this.settings().speedControl || this.filmOver()) return
		this.setRate(this.video, this.rate)
	}
	private setRate(video: HTMLVideoElement, rate: number) {
		if (Math.abs(video.playbackRate - rate) < 0.001) return
		video.playbackRate = rate
	}
	// sites reset the rate on new episodes, and some have their own speed menu: re-apply after a reset,
	// but treat any other change as the viewer choosing a new speed
	private onRateChange(video: HTMLVideoElement) {
		// a replaced element's teardown isn't the viewer choosing a speed, and once the film is over the site's own
		// rate stands without replacing the saved one
		if (video !== this.video || this.adRestore || this.rate === null || !this.settings().speedControl) return
		if (this.filmOver()) return
		// our own change (rate change events arrive after the fact, so compare rather than flag)
		if (Math.abs(video.playbackRate - this.rate) < 0.001) return
		if (video.playbackRate === 1 && this.rate !== 1 && video.currentTime < 3) {
			this.applyRate()
			return
		}
		this.chooseRate(video.playbackRate, false)
	}
	private chooseRate(rate: number, apply = true) {
		this.rate = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(rate * 100) / 100))
		saveRate(this.site.service, this.rate)
		if (apply) this.applyRate()
		if (this.site.hasNativeSpeedControl?.()) {
			// no pill to show the change on, so say it once
			if (apply) this.overlay.showNotice(`Speed ${formatRate(this.rate)}×`, [], 1500)
			return
		}
		this.renderedRate = this.rate
		this.overlay.renderSpeed(this.rate, SPEED_PRESETS, (value) => this.chooseRate(value))
		this.overlay.flashSpeed()
	}
	private onKey(event: KeyboardEvent) {
		if (!this.video || !this.settings().speedControl || this.rate === null || this.filmOver()) return
		const target = event.target as HTMLElement | null
		if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? "")) return
		// ">" / "<" on most layouts; some keyboards and tools report Shift with "." / ","
		const faster = event.key === ">" || (event.shiftKey && event.code === "Period")
		const slower = event.key === "<" || (event.shiftKey && event.code === "Comma")
		const step = faster ? SPEED_STEP : slower ? -SPEED_STEP : 0
		if (!step) return
		event.preventDefault()
		event.stopPropagation()
		this.chooseRate(this.rate + step)
	}
	// #endregion

	// #region time saved, batched into one storage write
	private recordSaved(kind: SkipKind | "ad", seconds: number) {
		this.pendingSaved[kind] = (this.pendingSaved[kind] ?? 0) + seconds
		clearTimeout(this.savedFlush)
		this.savedFlush = setTimeout(() => this.flushSaved(), 2000)
	}
	private async flushSaved() {
		const pending = this.pendingSaved
		this.pendingSaved = {}
		const { savedLog } = await browser.storage.local.get("savedLog")
		let log = (savedLog as SavedLog | undefined) ?? {}
		for (const [kind, seconds] of Object.entries(pending))
			log = addSavedSeconds(log, new Date(), kind, Math.round(seconds))
		await browser.storage.local.set({ savedLog: log })
	}
	// #endregion
}

function isShown(element: HTMLElement) {
	return element.isConnected && element.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false
}

async function loadRate(service: string): Promise<number> {
	try {
		const { playbackSpeed } = await browser.storage.local.get("playbackSpeed")
		const rate = (playbackSpeed as Record<string, number> | undefined)?.[service]
		return typeof rate === "number" && rate > 0 ? rate : 1
	} catch {
		return 1
	}
}
async function saveRate(service: string, rate: number) {
	const { playbackSpeed } = await browser.storage.local.get("playbackSpeed")
	await browser.storage.local.set({ playbackSpeed: { ...(playbackSpeed as object), [service]: rate } })
}

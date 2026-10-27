import { PlayerOverlay, formatClock, formatRate, formatSaved, type NoticeAction } from "./overlay"
import { isExcepted, loadRules, onRulesChanged, saveRules, showKey, withException } from "./rules"
import {
	loadVisits,
	recapText,
	returnText,
	saveVisit,
	showReturn,
	withVisit,
	type ShowReturn,
	type ShowVisits,
} from "./returns"
import { SKIP_LABELS, type PlaybackSettings, type SiteAdapter, type SkipKind, type SkipRules } from "./types"
import { addSavedSeconds, formatDuration, type SavedLog } from "@/utils/stats"
import { filmOver } from "@/utils/film-over"

const TICK_MS = 250
// a jump shorter than this is the video playing on while a skip lands, not a skip
const MIN_SAVED = 5
// the notice's button that stops a show's skips of that kind
const KEEP_LABELS = { intro: "Keep intros", recap: "Keep recaps", credits: "Keep credits" }
const SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const SPEED_STEP = 0.25
const SPEED_MIN = 0.25
const SPEED_MAX = 4
const FAST_FORWARD_RATE = 8
const SKIP_ORDER: SkipKind[] = ["intro", "recap", "credits", "stillWatching"]
// how long a recap waits for the player to name the show, to tell whether it's a return worth keeping the recap for
const RETURN_CHECK_MS = 3000

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
	// the countdown the last seek went by, which a slow player may still show once the ad is behind it
	private seekedAdRemaining: number | null = null
	// autoplay run: episodes started in a row without the viewer touching the page
	private autoplayRun = 0
	private touched = true
	private pendingPause = false
	private pendingSaved: Record<string, number> = {}
	private savedFlush: ReturnType<typeof setTimeout> | undefined
	// bedtime: a wall-clock sleep timer, or a one-off stop at the end of this title
	private sleepAt: number | null = null
	private sleepMinutes: number | null = null
	private stopAtEnd = false
	// a fired timer or stop holds the skips and ad handling until the title plays again
	private resting = false
	// seconds left in the title at the last tick, to tell autoplay moving on from the viewer picking another title
	private lastRemaining = Infinity
	private timeLabel = ""
	private topBarAnchor: HTMLElement | null = null
	// coming back to a show: the last episode played of each, and which shows this tab has already checked
	private visits: ShowVisits = {}
	private visitChecked = new Set<string>()
	private lastVisit = ""
	// set for the episode a return starts on; its recap plays unless the viewer skips it
	private returning: ShowReturn | null = null
	private recapOffered = false

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
		this.visits = await loadVisits()
		const touch = (event: Event) => {
			if (event.isTrusted) this.touched = true
		}
		document.addEventListener("pointerdown", touch, true)
		document.addEventListener("keydown", touch, true)
		// on window, in the capture phase, so players that swallow keystrokes don't see these first
		window.addEventListener("keydown", (event) => this.onKey(event), true)
		document.addEventListener(
			"pointermove",
			() => {
				this.overlay.flashSpeed()
				this.overlay.flashTime()
			},
			{ passive: true },
		)
		document.addEventListener("fullscreenchange", () => this.overlay.attach())
		this.timer = setInterval(() => this.tick(), TICK_MS)
	}
	stop() {
		clearInterval(this.timer)
		this.overlay.removeTime()
		this.overlay.detach()
	}

	// runs in background tabs too (browsers slow the timer there), so skips still happen while you listen elsewhere
	private tick() {
		const video = this.site.video()
		if (!video) {
			// a timer that runs out away from the player is spent, not kept for the next title
			if (this.sleepAt !== null && Date.now() >= this.sleepAt) this.sleepAt = this.sleepMinutes = null
			if (this.video) this.leavePlayer()
			return
		}
		if (video !== this.video) this.enterVideo(video)
		this.overlay.attach()
		this.alignToTopBar()
		this.checkEpisode(video)
		const settings = this.settings()
		this.noteVisit(settings)
		if (this.checkSleep(video)) return
		this.handleAds(video, settings)
		if (!this.adRestore) this.handleSkips(video, settings)
		this.handleSpeed(settings)
		this.updateTime(video)
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
		this.timeLabel = ""
		this.firstSeen.clear()
		this.overlay.removeSpeed()
		this.overlay.removeTime()
		this.overlay.detach()
	}

	// #region episodes and the autoplay pause
	private checkEpisode(video: HTMLVideoElement) {
		const key = this.site.episodeKey()
		if (!key || key === this.episode) return
		const first = this.episode === null
		this.episode = key
		// the stop was for the title that just ended: if autoplay got past it, stop here; if the viewer left it early, drop it
		if (this.stopAtEnd && !first) {
			if (this.lastRemaining < 120) this.fireStop(video)
			else this.stopAtEnd = false
		}
		this.suppressed.clear()
		this.lastPress.clear()
		this.firstSeen.clear()
		this.premiere = false
		this.returning = null
		this.recapOffered = false
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

	// #region coming back to a show
	// The player names the show and episode only some of the time (often only with its controls up), so this runs every
	// tick: the first time a show is named in this tab decides whether it's a return, and each new episode number seen
	// is saved as where the viewer is.
	private noteVisit(settings: PlaybackSettings) {
		const show = this.site.showTitle()
		if (!show) return
		const key = showKey(show)
		if (!this.visitChecked.has(key)) {
			this.visitChecked.add(key)
			this.returning = settings.returnReminders ? showReturn(this.visits, show, Date.now()) : null
			if (this.returning) this.overlay.showNotice(returnText(show, this.returning), [], 10_000)
		}
		const episode = this.site.episodeNumber()
		if (episode === null) return
		const season = this.site.episodeSeason?.() ?? null
		const id = `${key}|${season}|${episode}`
		if (id === this.lastVisit) return
		this.lastVisit = id
		const visit = { at: Date.now(), season, episode }
		this.visits = withVisit(this.visits, show, visit)
		saveVisit(show, visit).catch(() => {})
	}
	private offerRecap(button: HTMLElement, video: HTMLVideoElement, show: string | null, settings: PlaybackSettings) {
		if (this.recapOffered || !this.returning) return
		this.recapOffered = true
		this.overlay.showNotice(
			recapText(this.returning),
			[
				{
					label: "Skip recap",
					run: () => {
						this.returning = null
						if (button.isConnected) this.press("recap", button, video, show, settings)
					},
				},
			],
			15_000,
		)
	}
	// #endregion

	// #region skips
	private handleSkips(video: HTMLVideoElement, settings: PlaybackSettings) {
		const show = this.site.showTitle()
		// stopping after this title is independent of whether credits would otherwise have been skipped
		if (this.stopAtEnd) {
			const credits = this.site.skipButton("credits")
			if (credits && isShown(credits)) {
				this.fireStop(video)
				return
			}
		}
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
			if (kind === "recap" && this.returning) {
				this.offerRecap(button, video, show, settings)
				continue
			}
			const now = Date.now()
			const unnamed = kind === "recap" && settings.returnReminders && !show
			const wait = Math.max(settings.skipDelaySeconds * 1000, unnamed ? RETURN_CHECK_MS : 0)
			if (wait > 0) {
				const first = this.firstSeen.get(kind) ?? now
				this.firstSeen.set(kind, first)
				if (now - first < wait) continue
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
			if (settings.notices) this.overlay.showNotice("Answered “Still watching?”")
			return
		}
		const canSeek = !this.site.seekBlocked
		if (kind === "credits") {
			// announce now: the next episode replaces the player, so a notice after it would have nowhere to go
			if (remaining > 1 && remaining < 30 * 60) this.recordSaved(kind, remaining)
			if (settings.notices) this.announceSkip(kind, show ? [this.notForShow(kind, show)] : [])
			return
		}
		// the jump lands a moment after the click; measure it then (a page-read clock catches up a little later)
		setTimeout(
			() => {
				const saved = this.video === video ? clock().currentTime - before : 0
				if (saved > MIN_SAVED && saved < 30 * 60) this.recordSaved(kind, saved)
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
				this.announceSkip(kind, actions)
			},
			this.site.skipLandsMs ?? (this.site.clock ? 2500 : 700),
		)
	}
	private announceSkip(kind: SkipKind, actions: NoticeAction[]) {
		this.overlay.showNotice(`Skipped ${SKIP_LABELS[kind]}`, actions)
	}
	private notForShow(kind: Exclude<SkipKind, "stillWatching">, show: string, undo?: () => void): NoticeAction {
		return {
			label: KEEP_LABELS[kind],
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

	// measured every tick, so the pills follow a resize or fullscreen; an anchor kept in the page is measured again,
	// one the site redraws is looked up again
	private alignToTopBar() {
		if (!this.topBarAnchor?.isConnected) this.topBarAnchor = this.site.topBarAnchor?.() ?? null
		this.overlay.alignTo(this.topBarAnchor)
	}

	// #region bedtime
	// The time pill only appears with the player's own controls (pointer movement). Its menu is the sleep timer.
	private updateTime(video: HTMLVideoElement) {
		const clock = this.site.clock?.() ?? video
		// during a fast-forwarded ad the rate (and on some sites the clock) is the ad's, not the title's
		if (this.adRestore || this.filmOver() || !Number.isFinite(clock.duration) || clock.duration <= 0) {
			if (this.timeLabel) {
				this.timeLabel = ""
				this.overlay.removeTime()
			}
			return
		}
		const remaining = Math.max(0, clock.duration - clock.currentTime) / (video.playbackRate || 1)
		const sleep = this.sleepAt ? ` · sleep ${formatClock(this.sleepAt)}` : ""
		const label = `Ends ${formatClock(Date.now() + remaining * 1000)} · ${formatDuration(remaining)} left${sleep}`
		if (label === this.timeLabel) return
		this.timeLabel = label
		this.overlay.renderTime(label, () => this.showTimeMenu())
	}
	private showTimeMenu() {
		const isEpisode = this.site.episodeNumber() !== null
		this.overlay.openTimeMenu(
			{
				isEpisode,
				endsAt: this.timeLabel,
				sleepAt: this.sleepAt ? formatClock(this.sleepAt) : undefined,
				sleepMinutes: this.sleepMinutes ?? undefined,
				stopAtEnd: this.stopAtEnd,
			},
			{
				setSleep: (minutes) => {
					this.sleepMinutes = minutes
					this.sleepAt = Date.now() + minutes * 60_000
					this.stopAtEnd = false
					this.timeLabel = ""
					this.overlay.showNotice(`Sleep timer set · pausing at ${formatClock(this.sleepAt)}`, [
						{ label: "Cancel", run: () => this.cancelSleep() },
					])
				},
				setEnd: () => {
					this.stopAtEnd = true
					this.sleepAt = null
					this.sleepMinutes = null
					this.overlay.showNotice(`Stopping after this ${isEpisode ? "episode" : "film"}`, [], 4000)
				},
				cancel: () => this.cancelSleep(),
			},
		)
	}
	private cancelSleep() {
		const wasSleeping = this.sleepAt !== null
		this.sleepAt = null
		this.sleepMinutes = null
		this.stopAtEnd = false
		this.timeLabel = ""
		this.overlay.closeTimeMenu()
		this.overlay.showNotice(wasSleeping ? "Sleep timer cancelled" : "Won’t stop at the end", [], 3000)
	}
	private checkSleep(video: HTMLVideoElement) {
		if (this.resting && video.paused) return true
		this.resting = false
		if (this.sleepAt !== null && Date.now() >= this.sleepAt) {
			this.fireSleep(video)
			return true
		}
		const clock = this.site.clock?.() ?? video
		if (Number.isFinite(clock.duration)) this.lastRemaining = clock.duration - clock.currentTime
		const atEnd =
			video.ended || (Number.isFinite(clock.duration) && clock.duration > 1 && clock.currentTime >= clock.duration - 1)
		if (this.stopAtEnd && atEnd) {
			this.fireStop(video)
			return true
		}
		return false
	}
	private fireSleep(video: HTMLVideoElement) {
		this.sleepAt = null
		this.sleepMinutes = null
		this.timeLabel = ""
		this.resting = true
		video.pause()
		this.overlay.showNotice(
			`Sleep timer · paused at ${formatClock(Date.now())}`,
			[{ label: "Keep watching", run: () => video.play().catch(() => {}) }],
			60_000,
		)
	}
	private fireStop(video: HTMLVideoElement) {
		const isEpisode = this.site.episodeNumber() !== null
		this.stopAtEnd = false
		this.resting = true
		video.pause()
		this.overlay.showNotice(
			`Stopped after this ${isEpisode ? "episode" : "film"}`,
			[{ label: "Keep watching", run: () => video.play().catch(() => {}) }],
			60_000,
		)
	}
	// #endregion

	// #region ads
	private handleAds(video: HTMLVideoElement, settings: PlaybackSettings) {
		const remaining = settings.skipAds ? (this.site.adRemaining?.() ?? null) : null
		if (remaining === null || remaining <= 0) {
			if (this.adRestore) this.endFastForward(video)
			this.adAnnounced = false
			this.seekedAdRemaining = null
			return
		}
		if (this.site.adStrategy === "seek") {
			// one jump per ad break; the player reports the same break for a moment after the seek
			if (Date.now() - this.lastSeekedAd < 3000 || remaining === this.seekedAdRemaining) return
			this.lastSeekedAd = Date.now()
			this.seekedAdRemaining = remaining
			video.currentTime += remaining
			this.recordSaved("ad", remaining)
			if (settings.notices) this.overlay.showNotice("Skipped ad")
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

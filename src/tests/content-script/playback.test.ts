import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlaybackEngine } from "../../playback/engine"
import { isExcepted, showKey, withException, withoutException } from "../../playback/rules"
import { parseClock, parseEpisodeNumber } from "../../playback/sites/dom"
import type { PlaybackSettings, SiteAdapter, SkipKind } from "../../playback/types"
import { setFilmOver } from "../../utils/film-over"

describe("player text parsing", () => {
	it.each([
		["0:45", 45],
		["Ad 1:30", 90],
		["1:02:03", 3723],
		["", null],
		[null, null],
	])("parseClock(%s) = %s", (text, seconds) => {
		expect(parseClock(text)).toBe(seconds)
	})
	it.each([
		["S2 E5", 5],
		["Season 2, Ep. 5", 5],
		["E1", 1],
		["Flg. 3", 3],
		["Episode 12", 12],
		[undefined, null],
	])("parseEpisodeNumber(%s) = %s", (text, episode) => {
		expect(parseEpisodeNumber(text)).toBe(episode)
	})
})

describe("per-show rules", () => {
	it("matches shows however the site punctuates them", () => {
		expect(showKey("Love, Death & Robots")).toBe("love death robots")
		const rules = withException({}, "The Bear", "intro")
		expect(isExcepted(rules, "the bear", "intro")).toBe(true)
		expect(isExcepted(rules, "The Bear", "recap")).toBe(false)
		expect(isExcepted(withoutException(rules, "the bear", "intro"), "The Bear", "intro")).toBe(false)
	})
})

// a stand-in for the site's <video>: jsdom doesn't implement media playback
class FakeVideo extends EventTarget {
	currentTime = 100
	duration = 3000
	paused = false
	muted = false
	private rate = 1
	get playbackRate() {
		return this.rate
	}
	set playbackRate(value: number) {
		this.rate = value
		this.dispatchEvent(new Event("ratechange"))
	}
	play = vi.fn(async () => {
		this.paused = false
	})
	pause = vi.fn(() => {
		this.paused = true
	})
}

function setup(overrides: Partial<PlaybackSettings> = {}) {
	const video = new FakeVideo()
	const buttons: Partial<Record<SkipKind, HTMLButtonElement>> = {}
	const state = { episode: "ep1", episodeNumber: 2 as number | null, ad: null as number | null, show: "The Bear" }
	const site: SiteAdapter = {
		service: "Netflix",
		video: () => video as unknown as HTMLVideoElement,
		playerRoot: () => document.body,
		skipButton: (kind) => buttons[kind] ?? null,
		adRemaining: () => state.ad,
		adStrategy: "seek",
		episodeKey: () => state.episode,
		episodeNumber: () => state.episodeNumber,
		showTitle: () => state.show,
	}
	const settings: PlaybackSettings = {
		skip: { intro: true, recap: true, credits: true, stillWatching: true },
		skipAds: true,
		speedControl: true,
		keepFirstIntro: false,
		notices: true,
		pauseAfter: 0,
		...overrides,
	}
	const engine = new PlaybackEngine(site, () => settings)
	const tick = () => (engine as unknown as { tick: () => void }).tick()
	const addButton = (kind: SkipKind, jumpTo: number) => {
		const button = document.createElement("button")
		button.addEventListener("click", () => {
			video.currentTime = jumpTo
			button.remove()
		})
		document.body.append(button)
		buttons[kind] = button
		return button
	}
	return { video, site, settings, engine, tick, addButton, state, buttons }
}
const noticeText = () =>
	document.querySelector("[data-streambuddy]")?.shadowRoot?.querySelector(".notice")?.textContent ?? ""
const noticeButton = (label: string) =>
	Array.from(
		document.querySelector("[data-streambuddy]")?.shadowRoot?.querySelectorAll<HTMLButtonElement>(".notice button") ??
			[],
	).find((button) => button.textContent === label)

describe("playback engine", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		document.body.innerHTML = ""
		vi.mocked(browser.storage.sync.get).mockResolvedValue({})
		vi.mocked(browser.storage.local.get).mockResolvedValue({})
		vi.mocked(browser.storage.local.set).mockResolvedValue(undefined)
		vi.mocked(browser.storage.sync.set).mockResolvedValue(undefined)
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it("skips an intro, announces the time saved, and can undo it", async () => {
		const { video, tick, addButton } = setup()
		addButton("intro", 185)
		tick()
		expect(video.currentTime).toBe(185)
		vi.advanceTimersByTime(800)
		expect(noticeText()).toContain("Skipped intro")
		expect(noticeText()).toContain("1:25 saved")
		noticeButton("Undo")!.click()
		expect(video.currentTime).toBe(100)
		// undone for this episode: a fresh button is left alone
		addButton("intro", 185)
		tick()
		expect(video.currentTime).toBe(100)
	})

	it("leaves a show's intro alone after “Not for this show”", async () => {
		const { video, tick, addButton } = setup()
		addButton("intro", 185)
		tick()
		vi.advanceTimersByTime(800)
		noticeButton("Not for this show")!.click()
		expect(video.currentTime).toBe(100)
		expect(browser.storage.sync.set).toHaveBeenCalledWith({ skipRules: { "the bear": ["intro"] } })
	})

	it("offers no Undo where the player rejects seeks, and leaves the position alone", async () => {
		const { video, tick, addButton, site } = setup()
		site.seekBlocked = true
		addButton("intro", 185)
		tick()
		vi.advanceTimersByTime(800)
		expect(noticeText()).toContain("Skipped intro")
		expect(noticeButton("Undo")).toBeUndefined()
		noticeButton("Not for this show")!.click()
		expect(video.currentTime).toBe(185)
		expect(browser.storage.sync.set).toHaveBeenCalledWith({ skipRules: { "the bear": ["intro"] } })
	})

	it("announces a credits skip even when the next episode replaces the player", () => {
		const { tick, addButton, state } = setup()
		addButton("credits", 0)
		tick()
		// the site swaps in the next episode's player straight away
		state.episode = "ep2"
		expect(noticeText()).toContain("Skipped credits")
		expect(noticeText()).toContain("48:20 saved")
	})

	it("plays the intro on episode 1 when asked to", () => {
		const { video, tick, addButton, state } = setup({ keepFirstIntro: true })
		state.episodeNumber = 1
		addButton("intro", 185)
		tick()
		expect(video.currentTime).toBe(100)
	})

	it("ignores switched-off skips", () => {
		const { video, tick, addButton } = setup({ skip: { intro: false, recap: true, credits: true, stillWatching: true } })
		addButton("intro", 185)
		tick()
		expect(video.currentTime).toBe(100)
	})

	it("seeks past an ad once per break", () => {
		const { video, tick, state } = setup()
		state.ad = 30
		tick()
		expect(video.currentTime).toBe(130)
		tick()
		expect(video.currentTime).toBe(130)
	})

	it("fast-forwards ads muted where seeking isn't allowed, then restores the viewer's speed", async () => {
		const { video, tick, state, site, engine } = setup()
		site.adStrategy = "fastForward"
		await engine.start()
		engine.stop()
		;(engine as unknown as { rate: number }).rate = 1.5
		state.ad = 20
		tick()
		expect(video.playbackRate).toBe(8)
		expect(video.muted).toBe(true)
		state.ad = null
		tick()
		expect(video.playbackRate).toBe(1.5)
		expect(video.muted).toBe(false)
	})

	it("pauses when episodes keep autoplaying without the viewer touching anything", () => {
		const { video, tick, state } = setup({ pauseAfter: 2 })
		tick() // ep1, started by the viewer
		state.episode = "ep2"
		tick()
		expect(video.pause).not.toHaveBeenCalled()
		state.episode = "ep3"
		tick()
		expect(video.pause).toHaveBeenCalled()
		expect(noticeText()).toContain("Paused after 2 episodes in a row")
	})

	it("keeps counting autoplayed episodes when the player drops its video between them", () => {
		const { video, tick, state, site } = setup({ pauseAfter: 1 })
		const realVideo = site.video
		tick() // ep1, started by the viewer
		site.video = () => null
		tick() // a moment with no <video> while the next episode loads
		site.video = realVideo
		state.episode = "ep2"
		tick()
		expect(video.pause).toHaveBeenCalled()
	})

	it("changes speed from the keyboard and keeps it when the site resets the rate", async () => {
		const { video, tick, engine } = setup()
		await engine.start()
		tick()
		window.dispatchEvent(new KeyboardEvent("keydown", { key: ">", shiftKey: true }))
		expect(video.playbackRate).toBe(1.25)
		// a new episode starts at 1x
		video.currentTime = 0
		video.playbackRate = 1
		expect(video.playbackRate).toBe(1.25)
		engine.stop()
	})

	it("leaves the speed keys alone once the film is over", async () => {
		const { video, tick, engine } = setup()
		await engine.start()
		tick()
		setFilmOver(true)
		window.dispatchEvent(new KeyboardEvent("keydown", { key: ">", shiftKey: true }))
		expect(video.playbackRate).toBe(1)
		setFilmOver(false)
		engine.stop()
	})
})

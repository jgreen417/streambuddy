import { cssDeclarations } from "@/design/tokens"
import { installPageFont } from "@/utils/page-feature-styles"

// streamBuddy's in-player UI: a notice pill (bottom left), the speed pill (top centre) and, under it, the time pill
// with its sleep-timer menu. They live in one shadow root so the site's CSS can't reach them, and the host moves
// into whichever element is fullscreen.

const STYLE = `
:host { all: initial; ${cssDeclarations()} }
.layer { position: absolute; inset: 0; pointer-events: none; z-index: 2147483000;
	font: 500 14px/1.35 var(--sb-font-page);
	color: var(--sb-text); -webkit-font-smoothing: antialiased; }
.pill { pointer-events: auto; display: flex; align-items: center; gap: 10px;
	background: var(--sb-glass-dark); border: 1px solid var(--sb-line-raised);
	box-shadow: var(--sb-shadow-float); border-radius: var(--sb-radius-pill);
	backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.notice { position: absolute; left: 32px; bottom: 120px; max-width: min(560px, calc(100% - 64px));
	padding: 8px 8px 8px 16px; opacity: 0; transform: translateY(8px);
	transition: opacity 0.18s ease, transform 0.18s ease; }
.notice.show { opacity: 1; transform: none; }
.notice .text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notice .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sb-accent); flex: none; }
button { all: unset; cursor: pointer; padding: 6px 12px; border-radius: var(--sb-radius-pill); font-weight: 600; font-size: 13px;
	color: var(--sb-text); background: var(--sb-surface-raised); white-space: nowrap; }
button:hover { background: var(--sb-line-hover); }
button:focus-visible { outline: 2px solid var(--sb-focus); outline-offset: 2px; }
button.quiet { background: transparent; color: var(--sb-text-soft); }
button.quiet:hover { color: var(--sb-text); background: var(--sb-hairline); }
/* top centre: players keep their own buttons in the top corners */
.speed { position: absolute; left: 50%; transform: translateX(-50%); top: 20px; padding: 4px; gap: 2px; opacity: 0;
	transition: opacity 0.2s ease; }
.speed.show, .speed:hover, .speed:focus-within { opacity: 1; }
.speed .value { min-width: 52px; text-align: center; font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.speed .value.fast { color: var(--sb-up); }
.speed .presets { display: none; gap: 2px; }
.speed.open .presets { display: flex; }
.speed .presets button { padding: 6px 10px; }
.speed .presets button[aria-pressed="true"] { background: var(--sb-text); color: var(--sb-bg); }
/* under the speed pill, for the same reason; shown with the player's controls, like the speed pill */
.time { position: absolute; left: 50%; transform: translateX(-50%); top: 64px; padding: 4px; opacity: 0;
	pointer-events: none; transition: opacity 0.2s ease; }
.time.show, .time.open, .time:hover, .time:focus-within { opacity: 1; pointer-events: auto; }
.time .value { display: flex; align-items: center; gap: 8px; background: transparent; font-weight: 500;
	font-variant-numeric: tabular-nums; }
.time .value b { font-weight: 700; }
.time .icon { display: flex; }
.time .icon svg { width: 16px; height: 16px; }
.time-menu { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); min-width: 240px;
	padding: 8px; display: flex; flex-direction: column; gap: 2px; background: var(--sb-glass-dark);
	border: 1px solid var(--sb-line-raised); border-radius: var(--sb-radius-lg); box-shadow: var(--sb-shadow-float);
	backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.time-menu .head { padding: 4px 12px 0; font-weight: 700; }
.time-menu .ends { padding: 0 12px 6px; color: var(--sb-text-muted); font-size: 12px; }
.time-menu .status { display: flex; align-items: center; justify-content: space-between; gap: 8px;
	padding: 2px 2px 6px 12px; font-size: 13px; }
.time-menu .opt { display: flex; justify-content: space-between; background: transparent;
	border-radius: var(--sb-radius-md); font-weight: 500; }
.time-menu .opt:hover { background: var(--sb-line-hover); }
.time-menu .check { color: var(--sb-accent); }
.time-menu .rule { height: 1px; margin: 4px 8px; background: var(--sb-line-raised); }
@media (prefers-reduced-motion: reduce) { .notice, .speed, .time { transition: none; } }
`

export type NoticeAction = { label: string; quiet?: boolean; run: () => void }
export type TimeMenuState = {
	isEpisode: boolean
	endsAt: string
	sleepAt?: string
	sleepMinutes?: number
	stopAtEnd: boolean
}
export type TimeMenuActions = {
	setSleep: (minutes: number) => void
	setEnd: () => void
	cancel: () => void
}

export class PlayerOverlay {
	private host = document.createElement("div")
	private root = this.host.attachShadow({ mode: "open" })
	private layer = document.createElement("div")
	private notice = document.createElement("div")
	private noticeTimer: ReturnType<typeof setTimeout> | undefined
	private speed: HTMLDivElement | null = null
	private speedTimer: ReturnType<typeof setTimeout> | undefined
	private time: HTMLDivElement | null = null
	private timeValue: HTMLButtonElement | null = null
	private timeMenu: HTMLDivElement | null = null
	private timeTimer: ReturnType<typeof setTimeout> | undefined
	private timeOpener: (() => void) | null = null

	constructor(private findPlayerRoot: () => HTMLElement | null) {
		installPageFont()
		this.host.setAttribute("data-streambuddy", "player")
		const style = document.createElement("style")
		style.textContent = STYLE
		this.layer.className = "layer"
		this.notice.className = "notice pill"
		this.notice.setAttribute("role", "status")
		this.notice.setAttribute("aria-live", "polite")
		this.notice.addEventListener("mouseenter", () => clearTimeout(this.noticeTimer))
		this.notice.addEventListener("mouseleave", () => this.hideNoticeSoon(2500))
		this.layer.append(this.notice)
		this.root.append(style, this.layer)
		document.addEventListener("pointerdown", (event) => {
			if (this.timeMenu && !event.composedPath().includes(this.host)) this.closeTimeMenu()
		})
		this.host.addEventListener("keydown", (event) => {
			if (event.key !== "Escape" || !this.timeMenu) return
			event.preventDefault()
			this.closeTimeMenu()
		})
	}

	// keep the overlay inside the player (or the fullscreen element) as the site re-renders
	attach() {
		const parent = (document.fullscreenElement as HTMLElement | null) ?? this.findPlayerRoot()
		if (!parent) return false
		if (this.host.parentElement !== parent) {
			if (getComputedStyle(parent).position === "static") parent.style.position = "relative"
			Object.assign(this.host.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "2147483000" })
			parent.append(this.host)
		}
		return true
	}
	detach() {
		this.closeTimeMenu()
		this.host.remove()
	}

	showNotice(text: string, actions: NoticeAction[] = [], duration = 6000) {
		if (!this.attach()) return
		const dot = document.createElement("span")
		dot.className = "dot"
		const label = document.createElement("span")
		label.className = "text"
		label.textContent = text
		const buttons = actions.map((action) => {
			const button = document.createElement("button")
			button.type = "button"
			button.textContent = action.label
			if (action.quiet) button.className = "quiet"
			button.addEventListener("click", (event) => {
				event.stopPropagation()
				event.preventDefault()
				action.run()
				this.hideNoticeSoon(0)
			})
			return button
		})
		this.notice.replaceChildren(dot, label, ...buttons)
		this.notice.classList.add("show")
		this.hideNoticeSoon(duration)
	}
	private hideNoticeSoon(delay: number) {
		clearTimeout(this.noticeTimer)
		this.noticeTimer = setTimeout(() => this.notice.classList.remove("show"), delay)
	}

	// the speed pill: current speed, click to open presets; it shows while the pointer moves, like native controls
	renderSpeed(rate: number, presets: number[], onPick: (rate: number) => void) {
		if (!this.attach()) return
		if (!this.speed) {
			this.speed = document.createElement("div")
			this.speed.className = "speed pill"
			this.speed.setAttribute("role", "group")
			this.speed.setAttribute("aria-label", "Playback speed")
			this.layer.append(this.speed)
		}
		const value = document.createElement("button")
		value.type = "button"
		value.className = `value${rate > 1 ? " fast" : ""}`
		value.textContent = `${formatRate(rate)}×`
		value.title = "Playback speed (Shift + < or >)"
		value.setAttribute("aria-expanded", String(this.speed.classList.contains("open")))
		value.addEventListener("click", (event) => {
			event.stopPropagation()
			this.speed?.classList.toggle("open")
			value.setAttribute("aria-expanded", String(this.speed?.classList.contains("open")))
		})
		const list = document.createElement("div")
		list.className = "presets"
		for (const preset of presets) {
			const button = document.createElement("button")
			button.type = "button"
			button.textContent = `${formatRate(preset)}×`
			button.setAttribute("aria-pressed", String(Math.abs(preset - rate) < 0.01))
			button.addEventListener("click", (event) => {
				event.stopPropagation()
				onPick(preset)
			})
			list.append(button)
		}
		this.speed.replaceChildren(value, list)
	}
	flashSpeed(duration = 2500) {
		if (!this.speed) return
		this.speed.classList.add("show")
		clearTimeout(this.speedTimer)
		this.speedTimer = setTimeout(() => this.speed?.classList.remove("show", "open"), duration)
	}
	hasSpeed() {
		return !!this.speed?.isConnected
	}
	removeSpeed() {
		this.speed?.remove()
		this.speed = null
	}

	// the time pill: when the title ends, click to set a sleep timer or stop after this episode/film
	renderTime(label: string, onOpen: () => void) {
		if (!this.attach()) return
		if (!this.time) {
			this.time = document.createElement("div")
			this.time.className = "time pill"
			this.timeValue = document.createElement("button")
			this.timeValue.type = "button"
			this.timeValue.className = "value"
			this.timeValue.addEventListener("click", (event) => {
				event.stopPropagation()
				if (this.timeMenu) this.closeTimeMenu()
				else this.timeOpener?.()
			})
			this.time.append(this.timeValue)
			this.layer.append(this.time)
		}
		this.timeOpener = onOpen
		const [main, ...rest] = label.split(" · ")
		const icon = document.createElement("span")
		icon.className = "icon"
		icon.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.2 1.3"/></svg>`
		const copy = document.createElement("span")
		const strong = document.createElement("b")
		strong.textContent = main
		copy.append(strong)
		if (rest.length) copy.append(` · ${rest.join(" · ")}`)
		this.timeValue?.replaceChildren(icon, copy)
		if (this.timeValue) {
			this.timeValue.title = label
			this.timeValue.setAttribute("aria-label", label)
			this.timeValue.setAttribute("aria-expanded", String(!!this.timeMenu))
		}
	}
	flashTime(duration = 2500) {
		if (!this.time) return
		this.time.classList.add("show")
		clearTimeout(this.timeTimer)
		this.timeTimer = setTimeout(() => {
			if (!this.timeMenu) this.time?.classList.remove("show")
		}, duration)
	}
	removeTime() {
		this.closeTimeMenu()
		this.time?.remove()
		this.time = null
		this.timeValue = null
		this.timeOpener = null
		clearTimeout(this.timeTimer)
	}
	openTimeMenu(state: TimeMenuState, actions: TimeMenuActions) {
		if (!this.time) return
		this.closeTimeMenu()
		const menu = document.createElement("div")
		menu.className = "time-menu"
		menu.setAttribute("role", "dialog")
		menu.setAttribute("aria-label", "Sleep timer")
		const head = document.createElement("div")
		head.className = "head"
		head.textContent = "Sleep timer"
		menu.append(head)
		const ends = document.createElement("div")
		ends.className = "ends"
		ends.textContent = state.endsAt
		menu.append(ends)
		if (state.sleepAt || state.stopAtEnd) {
			const status = document.createElement("div")
			status.className = "status"
			const text = document.createElement("span")
			if (state.sleepAt) {
				text.append("Pausing at ")
				const at = document.createElement("b")
				at.textContent = state.sleepAt
				text.append(at)
			} else text.textContent = `Stopping after this ${state.isEpisode ? "episode" : "film"}`
			const cancel = document.createElement("button")
			cancel.type = "button"
			cancel.className = "quiet"
			cancel.textContent = "Cancel"
			cancel.addEventListener("click", (event) => {
				event.stopPropagation()
				this.closeTimeMenu()
				actions.cancel()
			})
			status.append(text, cancel)
			menu.append(status)
		}
		for (const minutes of [15, 30, 45, 60]) {
			const option = document.createElement("button")
			option.type = "button"
			option.className = "opt"
			option.append(`${minutes} minutes`)
			if (state.sleepMinutes === minutes) {
				const check = document.createElement("span")
				check.className = "check"
				check.textContent = "✓"
				option.append(check)
			}
			option.addEventListener("click", (event) => {
				event.stopPropagation()
				this.closeTimeMenu()
				actions.setSleep(minutes)
			})
			menu.append(option)
		}
		const rule = document.createElement("div")
		rule.className = "rule"
		menu.append(rule)
		const end = document.createElement("button")
		end.type = "button"
		end.className = "opt"
		end.append(`End of the ${state.isEpisode ? "episode" : "film"}`)
		if (state.stopAtEnd) {
			const check = document.createElement("span")
			check.className = "check"
			check.textContent = "✓"
			end.append(check)
		}
		end.addEventListener("click", (event) => {
			event.stopPropagation()
			this.closeTimeMenu()
			actions.setEnd()
		})
		menu.append(end)
		this.time.append(menu)
		this.timeMenu = menu
		this.time.classList.add("open")
		this.timeValue?.setAttribute("aria-expanded", "true")
		menu.querySelector<HTMLButtonElement>("button")?.focus()
	}
	// the pill fades again once its menu closes, and keyboard focus goes back to the pill rather than the page
	closeTimeMenu() {
		if (!this.timeMenu) return
		const hadFocus = this.timeMenu.contains(this.root.activeElement)
		this.timeMenu.remove()
		this.timeMenu = null
		this.time?.classList.remove("open", "show")
		this.timeValue?.setAttribute("aria-expanded", "false")
		if (hadFocus) this.timeValue?.focus()
	}
}

export const formatRate = (rate: number) => (Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0$/, ""))

const CLOCK = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
export const formatClock = (at: number) => CLOCK.format(new Date(at))

export function formatSaved(seconds: number) {
	const s = Math.max(0, Math.round(seconds))
	return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`
}

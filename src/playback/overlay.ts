// streamBuddy's in-player UI: a notice pill (bottom left) and the speed pill (top right). Both live in one
// shadow root so the site's CSS can't reach them, and the host moves into whichever element is fullscreen.

const STYLE = `
:host { all: initial; }
.layer { position: absolute; inset: 0; pointer-events: none; z-index: 2147483000;
	font: 500 14px/1.35 -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", sans-serif;
	color: #fbf4ec; -webkit-font-smoothing: antialiased; }
.pill { pointer-events: auto; display: flex; align-items: center; gap: 10px;
	background: rgba(27, 25, 24, 0.86); border: 1px solid rgba(251, 244, 236, 0.14);
	box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); border-radius: 999px;
	backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.notice { position: absolute; left: 32px; bottom: 120px; max-width: min(560px, calc(100% - 64px));
	padding: 8px 8px 8px 16px; opacity: 0; transform: translateY(8px);
	transition: opacity 0.18s ease, transform 0.18s ease; }
.notice.show { opacity: 1; transform: none; }
.notice .text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notice .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff7a45; flex: none; }
button { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 999px; font-weight: 600; font-size: 13px;
	color: #fbf4ec; background: rgba(251, 244, 236, 0.1); white-space: nowrap; }
button:hover { background: rgba(251, 244, 236, 0.18); }
button:focus-visible { outline: 2px solid #ffb38f; outline-offset: 2px; }
button.quiet { background: transparent; color: #cfc6bc; }
button.quiet:hover { color: #fbf4ec; background: rgba(251, 244, 236, 0.08); }
/* top centre: players keep their own buttons in the top corners */
.speed { position: absolute; left: 50%; transform: translateX(-50%); top: 20px; padding: 4px; gap: 2px; opacity: 0;
	transition: opacity 0.2s ease; }
.speed.show, .speed:hover, .speed:focus-within { opacity: 1; }
.speed .value { min-width: 52px; text-align: center; font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.speed .value.fast { color: #7ad9a0; }
.speed .presets { display: none; gap: 2px; }
.speed.open .presets { display: flex; }
.speed .presets button { padding: 6px 10px; }
.speed .presets button[aria-pressed="true"] { background: #fbf4ec; color: #1b1918; }
@media (prefers-reduced-motion: reduce) { .notice, .speed { transition: none; } }
`

export type NoticeAction = { label: string; quiet?: boolean; run: () => void }

export class PlayerOverlay {
	private host = document.createElement("div")
	private root = this.host.attachShadow({ mode: "open" })
	private layer = document.createElement("div")
	private notice = document.createElement("div")
	private noticeTimer: ReturnType<typeof setTimeout> | undefined
	private speed: HTMLDivElement | null = null
	private speedTimer: ReturnType<typeof setTimeout> | undefined

	constructor(private findPlayerRoot: () => HTMLElement | null) {
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
}

export const formatRate = (rate: number) => (Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0$/, ""))

export function formatSaved(seconds: number) {
	const s = Math.max(0, Math.round(seconds))
	return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`
}

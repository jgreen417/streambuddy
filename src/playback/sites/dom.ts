// small DOM helpers shared by the site adapters
export const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
	root.querySelector<T>(selector)

// the visible button whose text matches, for players that use one button for several skips
export function buttonWithText(selector: string, pattern: RegExp): HTMLElement | null {
	for (const button of Array.from(document.querySelectorAll<HTMLElement>(selector)))
		if (pattern.test(button.textContent ?? button.getAttribute("aria-label") ?? "")) return button
	return null
}

// "0:45", "1:02:03" or "Ad 0:30" -> seconds
export function parseClock(text: string | null | undefined): number | null {
	const match = /(\d+):(\d{2})(?::(\d{2}))?/.exec(text ?? "")
	if (!match) return null
	const [a, b] = [Number(match[1]), Number(match[2])]
	return match[3] === undefined ? a * 60 + b : a * 3600 + b * 60 + Number(match[3])
}

// "S2 E5", "Season 2, Ep. 5", "S1:E1" -> 2/1
export function parseSeason(text: string | null | undefined): number | null {
	const match = /(?:S|Season|Staffel|Saison|Temporada|Stagione|Seizoen|सीज़न)\s*:?\s*(\d+)/i.exec(text ?? "")
	return match ? Number(match[1]) : null
}

// "S2 E5", "Season 2, Ep. 5", "E5", "Flg. 5" -> 5
export function parseEpisodeNumber(text: string | null | undefined): number | null {
	if (!text) return null
	const explicit = /\b(?:E|Ep\.?|Episode|Flg\.?)\s*(\d+)/i.exec(text)
	if (explicit) return Number(explicit[1])
	const numbers = text.match(/\d+/g)
	return numbers?.length ? Number(numbers.at(-1)) : null
}

// the feature itself: players keep previews, ad slots and idents as extra <video>s, often at the same size.
// Prefer what's playing, then the longest, then the largest.
export function mainVideo(root: ParentNode = document): HTMLVideoElement | null {
	let best: HTMLVideoElement | null = null
	let bestScore = -1
	for (const video of Array.from(root.querySelectorAll("video"))) {
		if (video.readyState === 0) continue
		const rect = video.getBoundingClientRect()
		if (rect.width * rect.height === 0) continue
		const duration = Number.isFinite(video.duration) ? video.duration : 0
		const score = (video.paused ? 0 : 1e9) + duration * 1e3 + rect.width * rect.height * 1e-6
		if (score > bestScore) {
			best = video
			bestScore = score
		}
	}
	return best
}

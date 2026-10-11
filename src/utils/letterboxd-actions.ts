import { installPageFeatureStyle } from "./page-feature-styles"
import type { FeatureRating } from "./page-features"

export function extractLetterboxdCsrf(html: string): string | null {
	const scriptToken = html.match(/\bsupermodelCSRF\s*=\s*(["'])([a-zA-Z0-9._~-]+)\1/)?.[2]
	if (scriptToken && scriptToken !== "placeholder") return scriptToken
	for (const input of html.match(/<input\b[^>]*>/gi) ?? []) {
		if (/\bname\s*=\s*["']__csrf["']/i.test(input)) {
			const value = input.match(/\bvalue\s*=\s*["']([^"']+)["']/i)?.[1]
			if (value && value !== "placeholder") return value.replaceAll("&amp;", "&")
		}
	}
	return null
}

// Called only after the user confirms this specific film. Never log the session token.
export async function addLetterboxdWatchlist(slug: string, confirmed: boolean) {
	if (!confirmed) throw new Error("Confirmation required")
	if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Invalid film")
	const page = await fetch(`https://letterboxd.com/film/${slug}/`, { credentials: "include" })
	if (!page.ok) throw new Error("Open Letterboxd and sign in, then try again")
	const csrf = extractLetterboxdCsrf(await page.text())
	if (!csrf) throw new Error("Open Letterboxd and sign in, then try again")
	const response = await fetch(`https://letterboxd.com/film/${slug}/add-to-watchlist/`, {
		method: "POST",
		credentials: "include",
		headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest" },
		body: new URLSearchParams({ __csrf: csrf }),
	})
	const result = await response.json().catch(() => null)
	if (!response.ok || (result?.result !== true && result?.success !== true))
		throw new Error("Letterboxd did not confirm the change. Check your watchlist on Letterboxd.")
}

export class CreditsRatingPrompt {
	private prompted = new Set<string>()
	private current = ""
	tick(video: HTMLVideoElement | null, data: FeatureRating | null, enabled: boolean) {
		const key = data ? `${data.id}` : ""
		if (this.current !== key) document.querySelectorAll(".sb-rate-prompt").forEach((el) => el.remove())
		this.current = key
		if (!enabled) {
			document.querySelectorAll(".sb-rate-prompt").forEach((el) => el.remove())
			return
		}
		if (
			!video ||
			!data ||
			data.media_type !== "movie" ||
			!Number.isFinite(video.duration) ||
			video.duration < 20 * 60 ||
			video.currentTime < video.duration - 90
		) {
			document.querySelectorAll(".sb-rate-prompt").forEach((el) => el.remove())
			return
		}
		if (this.prompted.has(key)) return
		this.prompted.add(key)
		installPageFeatureStyle()
		const panel = document.createElement("aside")
		panel.className = "sb-rate-prompt"
		panel.setAttribute("aria-label", `Rate ${data.title}`)
		const title = document.createElement("div")
		title.className = "sb-rate-prompt-title"
		title.textContent = `Rate ${data.title} on Letterboxd?`
		panel.append(title)
		const link = document.createElement("a")
		link.href = data.rating_url?.startsWith("https://letterboxd.com/film/")
			? data.rating_url
			: `https://letterboxd.com/tmdb/${data.id}/`
		link.target = "_blank"
		link.rel = "noopener noreferrer"
		link.textContent = "Rate it"

		link.addEventListener("click", () => panel.remove())
		panel.append(link)
		const dismiss = document.createElement("button")
		dismiss.type = "button"
		dismiss.textContent = "Not now"

		dismiss.addEventListener("click", () => panel.remove())
		panel.append(dismiss)
		panel.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault()
				panel.remove()
			}
		})
		const container = document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : document.body
		container.append(panel)
	}
}

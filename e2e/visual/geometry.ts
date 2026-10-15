import type { Page } from "@playwright/test"
import { primeLogoBox } from "./art"

// The badge placement rules (the "Buddy" spec), measured on the rendered page:
// - it sits CORNER_GAP px in from the artwork's right edge and from its top (Netflix) or bottom (Prime, Max)
// - on Prime it sits CORNER_GAP px above the channel logo baked into the artwork instead of the bottom edge
// - it stays inside the artwork
// - its corners are concentric with the artwork's: badge radius = artwork radius - CORNER_GAP
export const CORNER_GAP = 3
const TOLERANCE = 0.6

export type Measurement = {
	card: string
	corner: "top" | "bottom"
	gapRight: number
	gapEdge: number
	inside: boolean
	artRadius: number
	badgeRadius: number
}

// every element marked data-sb-art, with the badge drawn for its card
export async function measure(page: Page) {
	const raw = await page.evaluate(() =>
		Array.from(document.querySelectorAll<HTMLElement>("[data-sb-art]")).map((art) => {
			let host: HTMLElement | null = art
			while (host && !host.querySelector(":scope > .sb-card-rating")) host = host.parentElement
			const badge = host?.querySelector<HTMLElement>(":scope > .sb-card-rating")
			const card = art.closest("a, article")
			const label = card?.getAttribute("aria-label") ?? card?.getAttribute("data-card-title") ?? "?"
			const rect = (el: Element) => el.getBoundingClientRect().toJSON() as DOMRect
			const radius = (el: Element) => Number.parseFloat(getComputedStyle(el).borderTopRightRadius) || 0
			const img = Array.from(art.querySelectorAll("img")).sort(
				(a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
			)[0]
			return {
				card: label.replaceAll(/[⁦-⁩]/g, ""),
				corner: (art.dataset.sbCorner ?? "bottom") as "top" | "bottom",
				art: rect(art),
				artRadius: radius(art),
				badge: badge ? rect(badge) : null,
				badgeRadius: badge ? radius(badge) : 0,
				src: decodeURIComponent(img?.currentSrc ?? ""),
			}
		}),
	)
	return raw.map((item): Measurement & { missing: boolean } => {
		const { art, badge } = item
		if (!badge) return { ...item, missing: true, gapRight: NaN, gapEdge: NaN, inside: false }
		const logo = primeLogoBox(item.src)
		// the edge the badge measures from: the artwork's top, its bottom, or the top of Prime's logo
		const floor = logo ? art.top + (logo.y / logo.height) * art.height : art.bottom
		return {
			card: item.card,
			corner: item.corner,
			missing: false,
			gapRight: round(art.right - badge.right),
			gapEdge: round(item.corner === "top" ? badge.top - art.top : floor - badge.bottom),
			inside:
				badge.left >= art.left - 0.5 &&
				badge.top >= art.top - 0.5 &&
				badge.right <= art.right + 0.5 &&
				badge.bottom <= art.bottom + 0.5,
			artRadius: item.artRadius,
			badgeRadius: item.badgeRadius,
		}
	})
}

const round = (value: number) => Math.round(value * 100) / 100

// a list of what's off, one line per card; empty when everything is to spec
export function specProblems(measurements: Awaited<ReturnType<typeof measure>>) {
	const problems: string[] = []
	for (const m of measurements) {
		if (m.missing) {
			problems.push(`${m.card}: no badge`)
			continue
		}
		if (Math.abs(m.gapRight - CORNER_GAP) > TOLERANCE)
			problems.push(`${m.card}: ${m.gapRight}px from the right edge, want ${CORNER_GAP}px`)
		if (Math.abs(m.gapEdge - CORNER_GAP) > TOLERANCE)
			problems.push(
				`${m.card}: ${m.gapEdge}px from the ${m.corner === "top" ? "top" : "bottom (or logo)"}, want ${CORNER_GAP}px`,
			)
		if (!m.inside) problems.push(`${m.card}: badge spills off the artwork`)
		const wantRadius = Math.max(m.artRadius - CORNER_GAP, 2)
		if (Math.abs(m.badgeRadius - wantRadius) > TOLERANCE)
			problems.push(
				`${m.card}: badge corner ${m.badgeRadius}px, want ${wantRadius}px (artwork ${m.artRadius}px less the gap)`,
			)
	}
	return problems
}

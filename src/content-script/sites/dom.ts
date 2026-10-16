import { parseEpisodeLabel, type PlayingEpisode } from "@/utils/series-finale"

export const text = (selector: string) => document.querySelector(selector)?.textContent?.trim()

// The grid or flex box that actually lays the search results out, found by walking up from each card, instead of
// reordering a framework-owned list. siblingSelector: what another result inside the same box looks like.
export function gridsAround(cardSelector: string, siblingSelector: string): HTMLElement[] {
	const grids = new Set<HTMLElement>()
	document.querySelectorAll<HTMLElement>(cardSelector).forEach((card) => {
		for (let parent = card.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
			const display = getComputedStyle(parent).display
			if (
				(display === "grid" || display === "flex") &&
				Array.from(parent.children).filter(
					(child) => child === card || child.contains(card) || child.querySelector(siblingSelector),
				).length > 1
			) {
				grids.add(parent)
				break
			}
		}
	})
	return [...grids]
}

// the episode playing, read off the player's episode label and show title; null when it's clearly an episode but
// can't be placed, undefined when it looks like a film
export function episodeFromPlayer(label: string | undefined, show: string | null): PlayingEpisode | null | undefined {
	const place = parseEpisodeLabel(label)
	if (place && show) return { show, ...place }
	if (
		document.querySelector('[data-testid="player-ux-season-episode"]') ||
		/(?:S\d+\s*:?\s*E\d+|Season\s+\d+|Episode\s+\d+)/i.test(document.title)
	)
		return null
	return undefined
}

import { getScoreBand, type RatingSource } from "./ratings"

const ROW_SELECTOR = 'section.carousel-row, section[data-testid$="_rail"], section[data-testid="standard-carousel"]'

export function normalizeRowScore(source: RatingSource, rating: number) {
	return source === "letterboxd" ? rating * 2 : rating
}

export function isBelowRatingCutoff(
	source: RatingSource,
	rating: number,
	band: number,
	votes: number,
	tmdbCutoff: number,
) {
	if (!Number.isFinite(rating) || rating <= 0) return false
	return source === "tmdb" ? votes >= 50 && rating < tmdbCutoff : getScoreBand(source, rating) < band
}

// Keep presentation separate from site styles, so toggles restore the original appearance.
export class RowPresentation {
	private cards = new Map<HTMLElement, { target: HTMLElement; score: number; hideTarget: HTMLElement }>()

	track(card: HTMLElement, target: HTMLElement, score: number, hideTarget = target) {
		const previous = this.cards.get(card)
		if (previous && previous.target !== target) this.clear(previous.target)
		if (previous && previous.hideTarget !== hideTarget) previous.hideTarget.classList.remove("sb-below-cutoff")
		this.cards.set(card, { target, score, hideTarget })
		if (!document.getElementById("sb-row-presentation-style")) {
			const style = document.createElement("style")
			style.id = "sb-row-presentation-style"
			style.textContent = `
				.sb-best-in-row { outline: 3px solid #00c878 !important; outline-offset: -3px !important; }
				.sb-watched { opacity: 0.45 !important; }
				.sb-watched:hover, .sb-watched:focus-within { opacity: 1 !important; }
				.sb-below-cutoff { display: none !important; }
			`
			document.head.append(style)
		}
	}
	prune(isCurrent: (card: HTMLElement) => boolean) {
		const removed: HTMLElement[] = []
		for (const [card, entry] of this.cards) {
			if (card.isConnected && entry.target.isConnected && isCurrent(card)) continue
			this.clear(entry.target)
			card.classList.remove("sb-watched")
			entry.hideTarget.classList.remove("sb-below-cutoff")
			this.cards.delete(card)
			removed.push(card)
		}
		return removed
	}

	refresh(
		options: { highlightBest: boolean; fadeWatched: boolean; hideBelow?: boolean },
		isWatched: (card: HTMLElement) => boolean,
		isBelow: (card: HTMLElement) => boolean = () => false,
	) {
		const rows = new Map<Element, number>()
		const eligible = new Set<HTMLElement>()
		for (const [card, entry] of this.cards) {
			if (!card.isConnected || !entry.target.isConnected) {
				this.clear(entry.target)
				card.classList.remove("sb-watched")
				entry.hideTarget.classList.remove("sb-below-cutoff")
				this.cards.delete(card)
				continue
			}
			entry.hideTarget.classList.toggle("sb-below-cutoff", !!options.hideBelow && isBelow(card))
			const row = card.closest(ROW_SELECTOR)
			let hidden = false
			for (let ancestor: HTMLElement | null = card; ancestor && ancestor !== row; ancestor = ancestor.parentElement) {
				if (
					ancestor.hidden ||
					ancestor.classList.contains("sb-below-cutoff") ||
					ancestor.style.display === "none" ||
					ancestor.style.visibility === "hidden"
				) {
					hidden = true
					break
				}
			}
			if (row && !hidden && Number.isFinite(entry.score) && entry.score > 0) {
				eligible.add(card)
				rows.set(row, Math.max(rows.get(row) ?? 0, entry.score))
			}
		}
		for (const [card, { target, score }] of this.cards) {
			const row = card.closest(ROW_SELECTOR)
			target.classList.toggle(
				"sb-best-in-row",
				options.highlightBest && eligible.has(card) && !!row && rows.get(row) === score,
			)
			card.classList.toggle("sb-watched", options.fadeWatched && isWatched(card))
		}
	}

	private clear(target: HTMLElement) {
		target.classList.remove("sb-best-in-row", "sb-watched")
	}
}

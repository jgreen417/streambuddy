import type { RatingSource } from "./ratings"
import { getScoreBand } from "./rating-sources"

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
	// hideTarget: the element the low-rating cut-off hides (the card's whole slot where the site has one)
	private cards = new Map<HTMLElement, HTMLElement>()

	track(card: HTMLElement, hideTarget: HTMLElement = card) {
		const previous = this.cards.get(card)
		if (previous && previous !== hideTarget) previous.classList.remove("sb-below-cutoff")
		this.cards.set(card, hideTarget)
		if (!document.getElementById("sb-row-presentation-style")) {
			const style = document.createElement("style")
			style.id = "sb-row-presentation-style"
			style.textContent = `
				.sb-watched { opacity: 0.45 !important; }
				.sb-watched:hover, .sb-watched:focus-within { opacity: 1 !important; }
				.sb-below-cutoff { display: none !important; }
			`
			document.head.append(style)
		}
	}
	prune(isCurrent: (card: HTMLElement) => boolean) {
		const removed: HTMLElement[] = []
		for (const [card, hideTarget] of this.cards) {
			if (card.isConnected && isCurrent(card)) continue
			this.forget(card, hideTarget)
			removed.push(card)
		}
		return removed
	}

	refresh(
		options: { fadeWatched: boolean; hideBelow?: boolean },
		isWatched: (card: HTMLElement) => boolean,
		isBelow: (card: HTMLElement) => boolean = () => false,
	) {
		for (const [card, hideTarget] of this.cards) {
			if (!card.isConnected) {
				this.forget(card, hideTarget)
				continue
			}
			hideTarget.classList.toggle("sb-below-cutoff", !!options.hideBelow && isBelow(card))
			card.classList.toggle("sb-watched", options.fadeWatched && isWatched(card))
		}
	}

	private forget(card: HTMLElement, hideTarget: HTMLElement) {
		card.classList.remove("sb-watched")
		hideTarget.classList.remove("sb-below-cutoff")
		this.cards.delete(card)
	}
}

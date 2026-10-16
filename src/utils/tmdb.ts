// TMDb ranks by relevance, which can put a remake, a namesake or a TV show first. Prefer an exact title match,
// and among exact matches (remakes) keep TMDb's top one unless another is clearly more watched (3x votes x popularity).
// Measured on 896 popular titles from UK Netflix/Prime/HBO Max: 93.3% -> 97.7% picked correctly.
type TMDBTitled = {
	title?: string
	original_title?: string
	name?: string
	original_name?: string
	vote_count?: number
	popularity?: number
}
const normalizeTitle = (title: string | undefined) =>
	(title ?? "")
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll("&", "and")
		// "Accountant²" -> "accountant 2", same as "Accountant 2"
		.replaceAll(/([a-z])(\d)/g, "$1 $2")
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim()
const REMAKE_OVERRIDE_RATIO = 3
const reach = (item: TMDBTitled) => ((item.vote_count ?? 0) + 1) * (item.popularity ?? 0)
export function pickBestMatch<T extends TMDBTitled>(results: T[] | undefined, query: string): T {
	const wanted = normalizeTitle(query)
	const candidates = results ?? []
	const exact = candidates.filter((item) =>
		[item.title, item.original_title, item.name, item.original_name].some((name) => normalizeTitle(name) === wanted),
	)
	// No exact title: TMDb's first result can be an unrated fan film or an unreleased show ("Cardboard Star Wars: A
	// New Hope" before Star Wars, the 2026 Harry Potter series before the film), so skip results nobody has rated.
	if (!exact.length) return candidates.find((item) => (item.vote_count ?? 0) > 0) ?? candidates[0]
	return exact.reduce((pick, item) => (reach(item) > REMAKE_OVERRIDE_RATIO * reach(pick) ? item : pick))
}

// A card labelled only "Season 1" (Prime lists seasons as their own cards) names no show, and searching TMDb for it
// matches whatever happens to be called "... Season 1".
const SEASON_ONLY = /^\s*(?:season|series|staffel|saison|temporada|stagione|seizoen|s)\s*-?\s*\d+\s*$/i
export function isSeasonOnlyTitle(title: string) {
	return SEASON_ONLY.test(title)
}

// Remembers which title each card was last checked for, so a card whose title has no rating isn't looked up and
// logged again on every tick. Prime recycles its cards, so a card showing a new title is checked again.
export class CheckedCards {
	private checked = new WeakMap<Element, { title: string; until: number }>()
	isChecked(card: Element, title: string, now = Date.now()) {
		const entry = this.checked.get(card)
		return !!entry && entry.title === title && entry.until > now
	}
	mark(card: Element, title: string, until = Number.POSITIVE_INFINITY) {
		this.checked.set(card, { title, until })
	}
}

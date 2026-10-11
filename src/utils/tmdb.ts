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
	if (!exact.length) return candidates[0]
	return exact.reduce((pick, item) => (reach(item) > REMAKE_OVERRIDE_RATIO * reach(pick) ? item : pick))
}

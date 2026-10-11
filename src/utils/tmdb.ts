import { getAccount, tmdbRequest } from "@/utils/account"
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

export async function fetchPosterInfo(
	title: string,
	mediaType: MediaType,
): Promise<{ posterPath: string | null; mediaType: MediaType } | null> {
	const locale = navigator?.language || "en-US"
	const queryType = mediaType ?? "multi"
	const url = `https://api.themoviedb.org/3/search/${queryType}?query=${encodeURIComponent(title)}&include_adult=false&language=${locale}&page=1`
	try {
		const { tmdbToken } = await getAccount()
		if (!tmdbToken) return null
		const request = tmdbRequest(url, tmdbToken)
		const response = await fetch(request.url, { method: "GET", headers: request.headers })
		const data = await response.json()
		const movie = pickBestMatch(
			(data?.results as Array<TMDBTitled & { media_type?: string; poster_path?: string }> | undefined)?.filter(
				(item) => item.media_type?.toLowerCase() !== "person",
			),
			title,
		)
		if (!movie) return null
		return {
			posterPath: movie.poster_path ?? null,
			mediaType: mediaType ?? (movie.media_type as MediaType) ?? null,
		}
	} catch (error) {
		console.error("fetchPosterInfo failed", title, error)
		return null
	}
}
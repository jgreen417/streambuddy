import { request, NetworkRequestError, readText, readJson } from "./network"
// External rating sources (Letterboxd for films, IMDb for TV and as a fallback).
// These run in the background service worker: neither site sends CORS headers to the
// streaming pages, so the content scripts can't fetch them directly.

export type RatingSource = "letterboxd" | "imdb" | "tmdb"
export type ExternalRating = {
	source: Exclude<RatingSource, "tmdb">
	// native scale: Letterboxd 0.5-5, IMDb 1-10
	rating: number
	rating_count: number
	url: string
	// Letterboxd only: average of the ratings from people the configured user follows (0.5-5)
	friends_rating?: number
	friends_count?: number
	// a few of those friends by name, for the badge tooltip
	friends?: FriendRating[]
	friends_unavailable?: true
}
export type FriendRating = { name: string; rating: number }

// A temporary failure (network error, rate limit, Cloudflare challenge) as opposed to "this title has no rating".
// Callers must not cache these, or one bad minute pins a title to the fallback rating for a month.
export class TransientLookupError extends NetworkRequestError {}
function assertNotTransient(response: Response, source: string) {
	if (!response.ok && response.status !== 404) throw new TransientLookupError(`${source} ${response.status}`)
}

// red, orange, yellow, light green, green: softened so a score reads as a pill of colour with dark text on it,
// and still as coloured text on the dark panels
export const SCORE_COLORS = ["#ff8a7a", "#ffb168", "#f2c94c", "#b5e07a", "#7ad9a0"]
// Band edges picked so each colour covers a similar share of what's actually streaming
// (popular titles on UK Netflix, Prime and HBO Max, Oct 2026): roughly 13/23/24/25/15%.
// Letterboxd films: median 3.3, only 15% reach 4.0. IMDb TV runs much higher: median 8.0.
export const SCORE_BANDS: Record<ExternalRating["source"], number[]> = {
	letterboxd: [2.5, 3, 3.5, 4],
	imdb: [7, 7.7, 8.2, 8.6],
}
// 0 = red ... 4 = green
export function getScoreBand(source: ExternalRating["source"], rating: number): number {
	const band = SCORE_BANDS[source].findIndex((edge) => rating < edge)
	return band == -1 ? SCORE_BANDS[source].length : band
}
export function getScoreColor(source: ExternalRating["source"], rating: number): string {
	return SCORE_COLORS[getScoreBand(source, rating)]
}

// Letterboxd wraps its JSON-LD in /* <![CDATA[ */ ... /* ]]> */, so a plain JSON.parse fails
const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
export function parseLetterboxdHtml(html: string): { rating: number; rating_count: number } | null {
	const raw = LD_JSON_RE.exec(html)?.[1]
	if (!raw) return null
	const json = raw
		.replace(/\/\*\s*<!\[CDATA\[\s*\*\//, "")
		.replace(/\/\*\s*\]\]>\s*\*\//, "")
		.trim()
	try {
		const aggregate = JSON.parse(json)?.aggregateRating
		const rating = Number(aggregate?.ratingValue)
		if (!rating) return null
		return { rating, rating_count: Number(aggregate?.ratingCount) || 0 }
	} catch {
		return null
	}
}

// letterboxd.com/tmdb/{id} redirects to the film page. It only knows TMDb *movie* ids:
// a TV id lands on an unrelated film (Breaking Bad's 1396 -> Tarkovsky's Mirror), so never call this for TV.
export function getLetterboxdSlug(url: string | undefined): string | undefined {
	return url ? /letterboxd\.com\/film\/([^/]+)\//.exec(url)?.[1] : undefined
}

// Letterboxd's slug for most films is just the title ("Fight Club" -> fight-club); remakes and namesakes get a year
// suffix. A guess is right for ~75% of streaming films, so it can be fetched while TMDb is still searching.
export function guessLetterboxdSlug(title: string): string {
	return title
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll(/['’]/g, "")
		.replaceAll("&", " ")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
}
// every film page says which TMDb film it is, which is how a guessed page gets verified
export function parseLetterboxdTmdbId(html: string): { id: number; type: string } | null {
	const id = /data-tmdb-id="(\d+)"/.exec(html)?.[1]
	const type = /data-tmdb-type="(\w+)"/.exec(html)?.[1]
	return id && type ? { id: Number(id), type } : null
}

export type LetterboxdFilm = ExternalRating & { tmdb?: { id: number; type: string } | null }
async function fetchLetterboxdFilm(path: string, username: string): Promise<LetterboxdFilm | null> {
	const film = await request(`https://letterboxd.com${path}`, async (response) => {
		assertNotTransient(response, "Letterboxd")
		const slug = getLetterboxdSlug(response.url)
		if (!response.ok || !slug) return null
		const friends = username ? fetchFriendsRating(username, slug).catch(() => null) : Promise.resolve(null)
		return { html: await readText(response), url: response.url, friends }
	})
	if (!film) return null
	const { html } = film
	const friends = await film.friends
	const parsed = parseLetterboxdHtml(html)
	if (!parsed) return null
	return {
		source: "letterboxd",
		...parsed,
		url: film.url,
		// count 0 means none of your friends rated it; undefined means their ratings couldn't be read
		friends_rating: friends?.count ? friends.rating : undefined,
		friends_count: friends?.count,
		friends_unavailable: username && friends === null ? true : undefined,
		friends: friends?.count ? friends.top : undefined,
		tmdb: parseLetterboxdTmdbId(html),
	}
}
export function fetchLetterboxdRating(tmdbMovieId: number, username = ""): Promise<LetterboxdFilm | null> {
	return fetchLetterboxdFilm(`/tmdb/${tmdbMovieId}/`, username)
}
// Letterboxd's /tmdb/{id} only understands film ids, but its /imdb/{id} finds the limited series it lists as films
export function fetchLetterboxdByImdb(imdbId: string, username = ""): Promise<LetterboxdFilm | null> {
	if (!/^tt\d+$/.test(imdbId)) return Promise.resolve(null)
	return fetchLetterboxdFilm(`/imdb/${imdbId}/`, username)
}
export function fetchLetterboxdGuess(slug: string, username = ""): Promise<LetterboxdFilm | null> {
	return fetchLetterboxdFilm(`/film/${slug}/`, username)
}

// Each row of letterboxd.com/{user}/friends/film/{slug}/ is a friend who watched it; rated ones carry rated-N (N = half stars)
const FRIEND_NAME_RE = /<a href="[^"]*" class="name">\s*([^<]+?)\s*<\/a>/
const FRIEND_RATING_RE = /class="col-rating[^"]*">\s*<span class="rating[^"]*\brated-(\d+)/
export function parseFriendRows(html: string): FriendRating[] {
	return html
		.split("<tr")
		.slice(1)
		.flatMap((row) => {
			const rating = FRIEND_RATING_RE.exec(row)?.[1]
			if (!rating) return []
			const name = decodeEntities(FRIEND_NAME_RE.exec(row)?.[1] ?? "")
			return [{ name, rating: Number(rating) / 2 }]
		})
}
export function parseFriendRatings(html: string): number[] {
	return parseFriendRows(html).map((friend) => friend.rating)
}
function decodeEntities(text: string) {
	return text
		.replaceAll("&amp;", "&")
		.replaceAll("&#039;", "'")
		.replaceAll("&quot;", '"')
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
}

// 25 friends per page; stop after 4 pages so one popular film can't fire off dozens of requests
const MAX_FRIEND_PAGES = 4
const FRIENDS_IN_TOOLTIP = 6
async function fetchFriendsRating(
	username: string,
	slug: string,
): Promise<{ rating: number; count: number; top: FriendRating[] } | null> {
	if (!/^\w+$/.test(username)) return null
	const base = `https://letterboxd.com/${username}/friends/film/${slug}/`
	const friends: FriendRating[] = []
	for (let page = 1; page <= MAX_FRIEND_PAGES; page++) {
		const html = await request(page == 1 ? base : `${base}page/${page}/`, async (response) => {
			if (!response.ok) return null
			return readText(response)
		})
		if (html === null) return null
		friends.push(...parseFriendRows(html))
		if (!html.includes(`/friends/film/${slug}/page/${page + 1}/`)) break
	}
	if (friends.length == 0) return { rating: 0, count: 0, top: [] }
	return {
		rating: friends.reduce((sum, friend) => sum + friend.rating, 0) / friends.length,
		count: friends.length,
		top: [...friends].sort((a, b) => b.rating - a.rating).slice(0, FRIENDS_IN_TOOLTIP),
	}
}

// The user's own Letterboxd diary: every film they've logged (with their rating, 0 = unrated) and their watchlist.
export type LetterboxdProfile = {
	username: string
	fetchedAt: number
	watched: Record<string, number>
	watchlist: string[]
}
// one <li class="griditem"> per film on /{user}/films/ and /{user}/watchlist/
export function parseProfileGrid(html: string): Array<{ slug: string; rating: number }> {
	return html
		.split('<li class="griditem">')
		.slice(1)
		.flatMap((item) => {
			const slug = /data-item-slug="([^"]+)"/.exec(item)?.[1]
			if (!slug) return []
			const end = item.indexOf("</li>")
			const rating = /\brated-(\d+)/.exec(end == -1 ? item : item.slice(0, end))?.[1]
			return [{ slug, rating: rating ? Number(rating) / 2 : 0 }]
		})
}
function getLastPage(html: string, path: string) {
	const pages = [...html.matchAll(new RegExp(`${path}page/(\\d+)/`, "g"))].map((match) => Number(match[1]))
	return Math.max(1, ...pages)
}
// 72 films per page, 28 per watchlist page; 40 pages covers ~2,900 logged films
const MAX_PROFILE_PAGES = 40
async function fetchProfileGrid(path: string): Promise<Array<{ slug: string; rating: number }>> {
	const html = await request(`https://letterboxd.com${path}`, async (response) => {
		assertNotTransient(response, "Letterboxd")
		return response.ok ? readText(response) : null
	})
	if (html === null) return []
	const lastPage = Math.min(getLastPage(html, path), MAX_PROFILE_PAGES)
	const rest = await Promise.all(
		Array.from({ length: lastPage - 1 }, async (_, index) => {
			return request(`https://letterboxd.com${path}page/${index + 2}/`, async (response) => {
				assertNotTransient(response, "Letterboxd")
				return response.ok ? parseProfileGrid(await readText(response)) : []
			})
		}),
	)
	return [parseProfileGrid(html), ...rest].flat()
}
export async function fetchLetterboxdProfile(username: string): Promise<LetterboxdProfile | null> {
	if (!/^\w+$/.test(username)) return null
	const [films, watchlist] = await Promise.all([
		fetchProfileGrid(`/${username}/films/`),
		fetchProfileGrid(`/${username}/watchlist/`),
	])
	return {
		username,
		fetchedAt: Date.now(),
		watched: Object.fromEntries(films.map((film) => [film.slug, film.rating])),
		watchlist: watchlist.map((film) => film.slug),
	}
}

export async function fetchImdbRating(imdbId: string): Promise<ExternalRating | null> {
	if (!/^tt\d+$/.test(imdbId)) return null
	const summary = await request(
		"https://caching.graphql.imdb.com/",
		async (response) => {
			assertNotTransient(response, "IMDb")
			return response.ok ? (await readJson(response))?.data?.title?.ratingsSummary : null
		},
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				// requests without this header are rejected with a 403
				"x-imdb-client-name": "imdb-web-next",
			},
			body: JSON.stringify({
				query: `{ title(id: "${imdbId}") { ratingsSummary { aggregateRating voteCount } } }`,
			}),
		},
	)
	if (!summary?.aggregateRating) return null
	return {
		source: "imdb",
		rating: summary.aggregateRating,
		rating_count: summary.voteCount ?? 0,
		url: `https://www.imdb.com/title/${imdbId}/`,
	}
}

export type ImdbEpisodeRating = {
	id: string
	season: number
	episode: number
	title: string
	rating: number
	votes: number
}
export async function fetchImdbEpisodes(imdbId: string, season: number): Promise<ImdbEpisodeRating[]> {
	if (!/^tt\d+$/.test(imdbId) || !Number.isInteger(season) || season < 1) throw new Error("Invalid series or season")
	const ratings: ImdbEpisodeRating[] = []
	let cursor: string | undefined
	for (let page = 0; page < 20; page++) {
		const after = cursor ? `, after: ${JSON.stringify(cursor)}` : ""
		const json = await request(
			"https://caching.graphql.imdb.com/",
			async (response) => {
				assertNotTransient(response, "IMDb episodes")
				if (!response.ok) throw new Error("Series not found")
				return readJson(response)
			},
			{
				method: "POST",
				headers: { "content-type": "application/json", "x-imdb-client-name": "imdb-web-next" },
				body: JSON.stringify({
					query: `{ title(id: "${imdbId}") { episodes { episodes(first: 100${after}, filter: {includeSeasons: ["${season}"]}) { edges { node { id titleText { text } ratingsSummary { aggregateRating voteCount } series { episodeNumber { seasonNumber episodeNumber } } } } pageInfo { hasNextPage endCursor } } } } }`,
				}),
			},
		)
		const connection = json?.data?.title?.episodes?.episodes
		if (json.errors?.length || !connection?.edges) throw new TransientLookupError("Episode ratings unavailable")
		for (const { node } of connection.edges) {
			const number = node.series?.episodeNumber
			if (
				number?.seasonNumber !== season ||
				!Number.isInteger(number.episodeNumber) ||
				number.episodeNumber < 1 ||
				!node.ratingsSummary?.aggregateRating ||
				!/^tt\d+$/.test(node.id)
			)
				continue
			ratings.push({
				id: node.id,
				season,
				episode: number.episodeNumber,
				title: node.titleText?.text ?? "",
				rating: node.ratingsSummary.aggregateRating,
				votes: node.ratingsSummary.voteCount ?? 0,
			})
		}
		if (!connection.pageInfo?.hasNextPage) return ratings
		const next = connection.pageInfo.endCursor
		if (!next || next === cursor) throw new TransientLookupError("Episode pagination unavailable")
		cursor = next
	}
	throw new TransientLookupError("Episode pagination limit reached")
}

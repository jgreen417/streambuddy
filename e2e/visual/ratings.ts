// The ratings the fixture pages are drawn with, seeded into the extension's rating cache (DBCache) so no title is
// looked up over the network. Each title covers one kind of badge: Letterboxd with friends and your own rating,
// watchlist, seen-without-a-rating, IMDb for TV, TMDb fallback (coloured, and grey when too few people voted),
// and the low and high ends of the colour scale.

type Friend = { name: string; rating: number }
type Seed = {
	source: "letterboxd" | "imdb" | "tmdb"
	rating?: number
	score?: number
	votes?: number
	media?: "movie" | "tv"
	friends?: Friend[]
	friendsCount?: number
}

const FRIENDS: Friend[] = [
	{ name: "sam", rating: 4.5 },
	{ name: "alex", rating: 4 },
	{ name: "priya", rating: 4 },
	{ name: "jo", rating: 3.5 },
]
const friends = (n: number, rating: number) => ({
	friends: FRIENDS.slice(0, Math.min(n, 4)).map((friend) => ({ ...friend, rating })),
	friendsCount: n,
})

export const SEEDS: Record<string, Seed> = {
	// Netflix
	"Past Lives": { source: "letterboxd", rating: 3.94, ...friends(7, 4.2) },
	"Dune: Part Two": { source: "letterboxd", rating: 4.36, ...friends(3, 4.1) },
	Wednesday: { source: "imdb", rating: 8.1, media: "tv" },
	"Squid Game": { source: "imdb", rating: 8, media: "tv" },
	"Rebel Moon": { source: "letterboxd", rating: 2.05 },
	"Glass Onion": { source: "letterboxd", rating: 3.48, ...friends(2, 3.5) },
	"Quiet Archive": { source: "tmdb", score: 6.4, votes: 12 },
	"Leave the World Behind": { source: "letterboxd", rating: 2.98, ...friends(1, 2.5) },
	"The Gentlemen": { source: "imdb", rating: 8, media: "tv" },
	"Stranger Things": { source: "imdb", rating: 8.7, media: "tv" },
	Bridgerton: { source: "imdb", rating: 7.3, media: "tv" },
	"The Irishman": { source: "letterboxd", rating: 3.86, ...friends(4, 4) },
	Adolescence: { source: "imdb", rating: 8.1, media: "tv" },
	"Carry-On": { source: "letterboxd", rating: 3.02 },
	Nonnas: { source: "letterboxd", rating: 3.35, ...friends(1, 3) },
	"The Life List": { source: "tmdb", score: 7.2, votes: 640 },
	"Ginny & Georgia": { source: "imdb", rating: 7.4, media: "tv" },
	Ripley: { source: "imdb", rating: 8.1, media: "tv" },
	"Baby Reindeer": { source: "imdb", rating: 7.7, media: "tv" },
	Leo: { source: "letterboxd", rating: 3.2 },
	Maestro: { source: "letterboxd", rating: 3.3, ...friends(2, 3) },
	"May December": { source: "letterboxd", rating: 3.6 },
	Nyad: { source: "letterboxd", rating: 3.4 },
	"Society of the Snow": { source: "letterboxd", rating: 4.0, ...friends(5, 4.5) },
	"The Killer": { source: "letterboxd", rating: 3.5 },
	Rustin: { source: "letterboxd", rating: 3.3 },
	"Pain Hustlers": { source: "letterboxd", rating: 2.6 },
	// Prime Video
	"The Boys": { source: "imdb", rating: 8.7, media: "tv" },
	Fallout: { source: "imdb", rating: 8.3, media: "tv" },
	Saltburn: { source: "letterboxd", rating: 3.42, ...friends(4, 3.5) },
	"Road House": { source: "letterboxd", rating: 2.71 },
	Air: { source: "letterboxd", rating: 3.62 },
	Reacher: { source: "imdb", rating: 8, media: "tv" },
	Yellowstone: { source: "imdb", rating: 8.6, media: "tv" },
	Invincible: { source: "imdb", rating: 8.7, media: "tv" },
	"The Holdovers": { source: "letterboxd", rating: 4.07, ...friends(6, 4.3) },
	"Anatomy of a Fall": { source: "letterboxd", rating: 4.1 },
	"Mr. & Mrs. Smith": { source: "imdb", rating: 7.8, media: "tv" },
	"The Idea of You": { source: "letterboxd", rating: 3.1, ...friends(2, 3) },
	"Red One": { source: "tmdb", score: 6.9, votes: 900 },
	Citadel: { source: "imdb", rating: 6.1, media: "tv" },
	// Max
	"The Last of Us": { source: "imdb", rating: 8.7, media: "tv" },
	Oppenheimer: { source: "letterboxd", rating: 4.2, ...friends(8, 4.4) },
	Barbie: { source: "letterboxd", rating: 3.71 },
	Hacks: { source: "imdb", rating: 8.2, media: "tv" },
	"Civil War": { source: "letterboxd", rating: 3.5 },
	"The Penguin": { source: "imdb", rating: 8.7, media: "tv" },
	Succession: { source: "imdb", rating: 8.8, media: "tv" },
	Challengers: { source: "letterboxd", rating: 3.82, ...friends(3, 4) },
	"Small Hours": { source: "tmdb", score: 5.1, votes: 300 },
}

// your own diary and watchlist on Letterboxd, keyed by the slugs of the titles above
export const PROFILE = {
	username: "buddy",
	watched: { "past-lives": 4.5, "glass-onion": 0, saltburn: 3, oppenheimer: 4.5 } as Record<string, number>,
	watchlist: ["dune-part-two", "air", "barbie", "the-holdovers"],
}

export const slug = (title: string) =>
	title
		.toLowerCase()
		.replaceAll("&", "")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")

// sources: the "Ratings from" setting; with IMDb only, the Letterboxd-rated films carry their IMDb score instead
export function dbCache(today: string, sources: "both" | "letterboxd" | "imdb" | "tmdb" = "both") {
	return Object.fromEntries(
		Object.entries(SEEDS).map(([title, given], i) => {
			const seed: Seed =
				sources === "imdb" && given.source === "letterboxd"
					? { source: "imdb", rating: Math.round((given.rating ?? 0) * 20) / 10, media: given.media }
					: given
			const letterboxd = seed.source === "letterboxd"
			return [
				title,
				{
					id: 1000 + i,
					title,
					score: seed.score ?? (seed.rating ? (letterboxd ? seed.rating * 2 : seed.rating) : 0),
					vote_count: seed.votes ?? 5000,
					release_date: "2023-06-02",
					media_type: seed.media ?? "movie",
					poster_path: null,
					date: today,
					db: "tmdb",
					source: seed.source,
					rating: seed.rating,
					rating_count: seed.rating ? 250_000 : undefined,
					rating_url: letterboxd
						? `https://letterboxd.com/film/${slug(title)}/`
						: seed.source === "imdb"
							? `https://www.imdb.com/title/tt${String(1000000 + i)}/`
							: undefined,
					friends_rating: seed.friends
						? seed.friends.reduce((sum, f) => sum + f.rating, 0) / seed.friends.length
						: undefined,
					friends_count: seed.friendsCount,
					friends: seed.friends,
					// must match CACHE_VERSION in src/content-script/shared-functions.ts, or the seeded ratings count as stale
					cacheVersion: 3,
					sources,
				},
			]
		}),
	)
}

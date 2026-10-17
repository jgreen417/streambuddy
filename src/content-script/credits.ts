// The review pill at the end credits: works out what's playing, looks it up ahead of the credits and puts the pill up
import { sendMessage } from "webext-bridge/content-script"
import { findSeriesFinale } from "@/utils/lookup"
import { CreditsRatingPrompt, SHORTEST_FILM, creditsLength, inCredits } from "@/utils/credits-review"
import type { FeatureRating } from "@/utils/page-features"
import { shareLookup, type PlayingEpisode } from "@/utils/series-finale"
import { lookupMovieInfo, today, type MovieInfo } from "./cache"
import { letterboxdUsername, loggedRating } from "./profile"
import { settings } from "@/stores/settings"
import { locale, ratingSources } from "./settings"
import type { RatingsSite } from "./sites/types"
import { setFilmOver } from "@/utils/film-over"
import type { RatingSources } from "@/stores/storeTypes"

const creditsPrompt = new CreditsRatingPrompt(() => {
	Promise.resolve(sendMessage("openAccountSetup", {}, "background")).catch(() => {})
})
let playerLookup: {
	title: string
	sources: RatingSources
	data: FeatureRating | null
	pending?: Promise<unknown>
	retry: number
} | null = null

// the review pill, once up, stays put until it's dismissed or you're a couple of minutes into something else:
// Netflix swaps the film for a trailer about 10 seconds into its end screen and then leaves the player, and Prime
// autoplays the next film in the same video and moves to its page
let creditsShownFor: number | null = null
// where in the film the pill came up, to tell scrubbing back into the film from the credits rolling on
let creditsShownAt = 0
export function updateCreditsPrompt(site: RatingsSite) {
	const enabled = settings.value.General.rateOnCredits
	setFilmOver(false)
	if (!enabled) {
		creditsPrompt.tick(null, null, false)
		return
	}
	const video = filmVideo()
	const watchingSomethingElse =
		!!video && video.duration !== creditsShownFor && video.currentTime > 2 * 60 && !video.paused
	if (creditsPrompt.showing && creditsShownFor !== null && !watchingSomethingElse) {
		// a different, short video is Netflix's trailer; a different full-length one is the next film starting
		setFilmOver(
			!video ||
				(video.duration === creditsShownFor ? video.currentTime >= creditsShownAt - 1 : video.duration < SHORTEST_FILM),
		)
		placeCreditsReview(site)
		return
	}
	creditsShownFor = null
	if (!site.isPlayerPage()) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const metadata = site.creditsMetadata?.()
	// how long the service says the credits run, when it does
	const marked = video && metadata?.creditsShare ? metadata.creditsShare * video.duration : undefined
	// look the film up a couple of minutes before its credits, so it's ready when they start
	if (!video || !inCredits(video, (marked ?? creditsLength(video.duration)) + 2 * 60)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	// films, and the last episode of a limited series; never the rest of a show
	const episode = site.playingEpisode(metadata)
	if (episode === null) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const raw = episode ? episode.show : site.playingTitle(metadata)
	const title = raw
		?.replace(/^Prime Video:\s*/i, "")
		.split(/\s*[•·|]\s*/)[0]
		?.trim()
	if (!title || /^(Netflix|Prime Video|HBO\s*Max)$/i.test(title)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const key = episode ? `${title}|S${episode.season}E${episode.episode}` : title
	if (playerLookup?.title !== key || playerLookup.sources !== ratingSources())
		playerLookup = { title: key, sources: ratingSources(), data: null, retry: 0 }
	// a rating whose friends' scores failed to load is shown meanwhile and looked up again once it's due a retry
	const due = (playerLookup.data as { retryAfter?: number } | null)?.retryAfter ?? Number.POSITIVE_INFINITY
	if (!playerLookup.pending && (!playerLookup.data || due <= Date.now()) && playerLookup.retry <= Date.now()) {
		const current = playerLookup
		current.pending = (episode ? lookupSeriesFinale({ ...episode, show: title }) : lookupMovieInfo(title, null, null))
			.then((data) => {
				current.data = data ?? current.data
			})
			.catch(() => {})
			.finally(() => {
				current.pending = undefined
				current.retry = Date.now() + 30_000
			})
	}
	// the services' own end screens come up when the credits start, even without a marker in their metadata
	const endScreen = site.endScreenShowing(video)
	creditsPrompt.tick(
		video,
		playerLookup.data,
		true,
		{
			username: letterboxdUsername(),
			watched: playerLookup.data ? loggedRating(playerLookup.data, true) : undefined,
			friends: settings.value.General.friendsRatings,
		},
		endScreen ? video.duration : marked,
	)
	if (creditsPrompt.showing) {
		creditsShownFor = video.duration
		creditsShownAt = video.currentTime
		setFilmOver(true)
		placeCreditsReview(site)
	}
}
const finaleLookups = new Map<string, Promise<MovieInfo | null>>()
function lookupSeriesFinale(episode: PlayingEpisode): Promise<MovieInfo | null> {
	const key = `${episode.show}|S${episode.season}E${episode.episode}|${settings.value.General.friendsRatings}`
	return shareLookup(finaleLookups, key, () => lookupFinale(episode)).then((found) => {
		// friends' ratings failed for a moment: let the retry after retryAfter ask again rather than reuse this
		if (found?.retryAfter) finaleLookups.delete(key)
		return found
	})
}
// the pill's rating for a limited series' last episode
async function lookupFinale(episode: PlayingEpisode): Promise<MovieInfo | null> {
	const found = await findSeriesFinale(episode, settings.value.General.friendsRatings, locale())
	if (!found) return null
	const { match, letterboxd } = found
	return {
		id: match.id,
		media_type: "tv",
		title: match.name || match.original_name || episode.show,
		score: match.vote_average,
		vote_count: match.vote_count,
		release_date: match.first_air_date,
		poster_path: match.poster_path ?? null,
		date: today(),
		db: "tmdb",
		source: letterboxd.source,
		rating: letterboxd.rating,
		rating_count: letterboxd.rating_count,
		rating_url: letterboxd.url,
		friends_rating: letterboxd.friends_rating,
		friends_count: letterboxd.friends_count,
		friends: letterboxd.friends,
		retryAfter: letterboxd.friends_unavailable ? Date.now() + 30_000 : undefined,
	}
}
// the longest video on the page is the film: Prime keeps its detail page's trailer underneath the player
function filmVideo() {
	let film: HTMLVideoElement | null = null
	for (const video of Array.from(document.querySelectorAll("video")))
		if (Number.isFinite(video.duration) && (!film || video.duration > film.duration)) film = video
	return film
}
// clear of each service's own end-of-film UI
function placeCreditsReview(site: RatingsSite) {
	const review = document.querySelector<HTMLElement>(".sb-review")
	if (review) site.placeReview(review)
}

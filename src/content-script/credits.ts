// The review pill at the end credits: works out what's playing, looks it up ahead of the credits and puts the pill up.
// The same lookup tells the playback engine when a show's very last episode is ending.
import { sendMessage } from "webext-bridge/content-script"
import { findSeriesFinale, isLookupError } from "@/utils/lookup"
import { CreditsRatingPrompt, creditsLength, inCredits, playerTitle } from "@/utils/credits-review"
import { shareLookup, type PlayingEpisode } from "@/utils/series-finale"
import { lookupMovieInfo, today, type MovieInfo } from "./cache"
import { letterboxdUsername, loggedRating } from "./profile"
import { settings } from "@/stores/settings"
import { locale, ratingSources } from "./settings"
import type { RatingsSite } from "./sites/types"
import { setFilmEnded } from "@/utils/film-over"
import { setSeriesEnding } from "@/utils/series-ending"
import type { RatingSources } from "@/stores/storeTypes"

const creditsPrompt = new CreditsRatingPrompt(() => {
	Promise.resolve(sendMessage("openAccountSetup", {}, "background")).catch(() => {})
})
let playerLookup: {
	title: string
	sources: RatingSources
	data: MovieInfo | null
	finale: Finale | null
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
	const pauseAtEnding = settings.value.General.finaleEnding
	setFilmEnded(null)
	if (!enabled && !pauseAtEnding) {
		setSeriesEnding(null)
		creditsPrompt.tick(null, null, false)
		return
	}
	const video = site.playerClock ? site.playerClock() : filmVideo()
	const watchingSomethingElse =
		!!video && video.duration !== creditsShownFor && video.currentTime > 2 * 60 && !video.paused
	if (creditsPrompt.showing && creditsShownFor !== null && !watchingSomethingElse) {
		setFilmEnded({ duration: creditsShownFor, at: creditsShownAt })
		placeCreditsReview(site)
		return
	}
	creditsShownFor = null
	if (!site.isPlayerPage()) {
		setSeriesEnding(null)
		creditsPrompt.tick(null, null, true)
		return
	}
	const metadata = site.creditsMetadata?.()
	// how long the service says the credits run, when it does
	const marked = video
		? (site.creditsFromEnd?.(video) ?? (metadata?.creditsShare ? metadata.creditsShare * video.duration : undefined))
		: undefined
	// look the film up a couple of minutes before its credits, so it's ready when they start
	if (!video || !inCredits(video, (marked ?? creditsLength(video.duration)) + 2 * 60)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	// films, and the last episode of a show; never the rest of it. Films only matter to the pill.
	const episode = site.playingEpisode(metadata)
	if (episode === null || (episode === undefined && !enabled)) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const raw = episode ? episode.show : site.playingTitle(metadata)
	const title = playerTitle(raw)
	if (!title) {
		creditsPrompt.tick(null, null, true)
		return
	}
	const key = episode ? `${title}|S${episode.season}E${episode.episode}` : title
	if (playerLookup?.title !== key || playerLookup.sources !== ratingSources()) {
		playerLookup = { title: key, sources: ratingSources(), data: null, finale: null, retry: 0 }
		setSeriesEnding(null)
	}
	// a rating whose friends' scores failed to load is shown meanwhile and looked up again once it's due a retry
	const due = playerLookup.data?.retryAfter ?? Number.POSITIVE_INFINITY
	if (!playerLookup.pending && (!playerLookup.data || due <= Date.now()) && playerLookup.retry <= Date.now()) {
		const current = playerLookup
		const lookup = episode
			? lookupSeriesFinale({ ...episode, show: title }).then((finale) => {
					current.finale = finale ?? current.finale
					return finale?.info ?? null
				})
			: lookupMovieInfo(title, null, null)
		current.pending = lookup
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
	const finale = playerLookup.finale
	if (pauseAtEnding && finale?.ended) {
		// Letterboxd's pill offers the rating when it's up; otherwise the ending notice links to one
		const rate = enabled && playerLookup.data ? undefined : finale.rate
		setSeriesEnding({
			show: title,
			duration: video.duration,
			creditsAt: Math.min(video.duration - (marked ?? 0), endScreen ? video.currentTime : Number.POSITIVE_INFINITY),
			rate,
		})
	}
	creditsPrompt.tick(
		video,
		playerLookup.data,
		enabled,
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
		setFilmEnded({ duration: creditsShownFor, at: creditsShownAt })
		placeCreditsReview(site)
	}
}
// a show's last episode: Letterboxd's rating for the pill when it lists the show, whether the show has ended, and where
// else to rate it
type Finale = { info: MovieInfo | null; ended: boolean; rate?: { label: string; url: string }; retry: boolean }
const finaleLookups = new Map<string, Promise<Finale | null>>()
function lookupSeriesFinale(episode: PlayingEpisode): Promise<Finale | null> {
	const key = `${episode.show}|S${episode.season}E${episode.episode}|${settings.value.General.friendsRatings}`
	return shareLookup(finaleLookups, key, () => lookupFinale(episode)).then((found) => {
		// Letterboxd or friends' ratings failed for a moment: let the retry after 30s ask again rather than reuse this
		if (found?.info?.retryAfter || found?.retry) finaleLookups.delete(key)
		return found
	})
}
async function lookupFinale(episode: PlayingEpisode): Promise<Finale | null> {
	const found = await findSeriesFinale(episode, settings.value.General.friendsRatings, locale())
	if (!found) return null
	const { match, ended, imdbId } = found
	const letterboxd = found.letterboxd && !isLookupError(found.letterboxd) ? found.letterboxd : null
	const rate = letterboxd?.url?.startsWith("https://letterboxd.com/")
		? { label: "Rate on Letterboxd", url: letterboxd.url }
		: imdbId
			? { label: "Rate on IMDb", url: `https://www.imdb.com/title/${imdbId}/` }
			: undefined
	const info: MovieInfo | null = letterboxd && {
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
	return { info, ended, rate, retry: isLookupError(found.letterboxd) }
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

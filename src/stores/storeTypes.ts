// Per-service options. Every service has the same playback switches so the popup can edit several at once.
type ServicePlayback = {
	skipIntro: boolean
	skipRecap: boolean
	skipCredits: boolean
	skipStillWatching: boolean
	skipAd: boolean
	speedControl: boolean
	showRating: boolean
}
export type BadgeStyle = "classic" | "glass"
export type FriendsStyle = "labels" | "dots" | "trio"
// where badge scores come from; TMDb is always the last fallback
export type RatingSources = "both" | "letterboxd" | "imdb" | "tmdb"
export type settingsType = {
	Netflix: ServicePlayback & {
		// hide the mobile-games rows that fill the Netflix homepage
		hideGames: boolean
		// hide the ranked "Top 10" row
		hideTop10: boolean
	}
	Amazon: ServicePlayback & {
		// hide titles that need renting, buying or an add-on subscription
		hidePaid: boolean
	}
	HBO: ServicePlayback
	Disney: ServicePlayback
	Video: {
		dimLowRatings: boolean
	}
	General: {
		// last time the rating cache was pruned
		GCdate: string
		friendsRatings: boolean
		// "both": Letterboxd for films, IMDb for TV and films Letterboxd hasn't rated
		ratingSources: RatingSources
		// how the badge shows friends' score (and yours): labelled lines beside the score, a dot per friend, or always the same three dots
		friendsStyle: FriendsStyle
		badgeStyle: BadgeStyle
		// Liquid Glass frost, 0 (clear) to 100 (frosted)
		glassFrost: number
		// with dimLowRatings on, dim titles in a colour band below this one (1 = below orange ... 4 = below green)
		dimBelowBand: number
		// mark films already logged on Letterboxd (and watchlist ones) on the badges
		markWatched: boolean
		fadeWatched: boolean
		hideBelowRating: boolean
		episodeRatings: boolean
		searchSort: boolean
		rateOnCredits: boolean
		// a notice with Undo whenever something is skipped
		skipNotices: boolean
		// let the first episode of a season play its intro
		keepFirstIntro: boolean
		// pause when this many episodes autoplay in a row without the viewer touching anything; 0 = off
		pauseAfter: number
		// mute autoplay previews and trailers while browsing
		quietPreviews: boolean
	}
}

const playbackDefaults: ServicePlayback = {
	skipIntro: true,
	skipRecap: true,
	skipCredits: true,
	skipStillWatching: true,
	skipAd: true,
	speedControl: true,
	showRating: true,
}

// Default settings
export const defaultSettings: settingsType = {
	Netflix: { ...playbackDefaults, hideGames: true, hideTop10: false },
	Amazon: { ...playbackDefaults, hidePaid: false },
	HBO: { ...playbackDefaults },
	Disney: { ...playbackDefaults },
	Video: {
		dimLowRatings: false,
	},
	General: {
		GCdate: "2024-01-01",
		friendsRatings: true,
		ratingSources: "both",
		friendsStyle: "labels",
		badgeStyle: "classic",
		glassFrost: 60,
		dimBelowBand: 1,
		markWatched: true,
		fadeWatched: true,
		hideBelowRating: false,
		episodeRatings: true,
		searchSort: true,
		rateOnCredits: true,
		skipNotices: true,
		keepFirstIntro: false,
		pauseAfter: 0,
		quietPreviews: true,
	},
}

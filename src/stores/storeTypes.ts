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
export type settingsType = {
	Netflix: ServicePlayback & {
		// hide the mobile-games rows that fill the Netflix homepage
		hideGames: boolean
	}
	Amazon: ServicePlayback & {
		// hide titles that need renting, buying or an add-on subscription
		hidePaid: boolean
	}
	HBO: ServicePlayback
	Video: {
		dimLowRatings: boolean
	}
	General: {
		// last time the rating cache was pruned
		GCdate: string
		friendsRatings: boolean
		// with dimLowRatings on, dim titles in a colour band below this one (1 = below orange ... 4 = below green)
		dimBelowBand: number
		// mark films already logged on Letterboxd (and watchlist ones) on the badges
		markWatched: boolean
		highlightBestInRow: boolean
		fadeWatched: boolean
		hideBelowRating: boolean
		detailRatings: boolean
		episodeRatings: boolean
		searchSort: boolean
		letterboxdActions: boolean
		rateOnCredits: boolean
		// a notice with Undo whenever something is skipped
		skipNotices: boolean
		// let the first episode of a season play its intro
		keepFirstIntro: boolean
		// pause when this many episodes autoplay in a row without the viewer touching anything; 0 = off
		pauseAfter: number
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
	Netflix: { ...playbackDefaults, hideGames: true },
	Amazon: { ...playbackDefaults, hidePaid: false },
	HBO: { ...playbackDefaults },
	Video: {
		dimLowRatings: false,
	},
	General: {
		GCdate: "2024-01-01",
		friendsRatings: true,
		dimBelowBand: 1,
		markWatched: true,
		highlightBestInRow: true,
		fadeWatched: true,
		hideBelowRating: false,
		detailRatings: true,
		episodeRatings: true,
		searchSort: true,
		letterboxdActions: true,
		rateOnCredits: true,
		skipNotices: true,
		keepFirstIntro: false,
		pauseAfter: 0,
	},
}

// What every streaming service's content script runs, given that service's adapter (sites/*.ts)
import { SERVICES } from "@/constants/streamingServices"
import { fetchEpisodeRatings } from "@/utils/lookup"
import { EpisodeRatings, type EpisodeRating, type FeatureRating } from "@/utils/page-features"
import { badgeLook } from "@/utils/page-feature-styles"
import { cached, getDiffInDays, isCacheCurrent, loadCache, lookupMovieInfo } from "./cache"
import { updateCreditsPrompt } from "./credits"
import { watchLetterboxdProfile } from "./profile"
import { loadOverrides } from "./overrides"
import { forgetCards, refreshRowPresentation, startCards, updateSearchSorting } from "./scan"
import { settings, settingsReady } from "@/stores/settings"
import { ratingSources } from "./settings"
import { listenForRatingsShortcut } from "./shortcut"
import type { RatingsSite } from "./sites/types"
import { startWatchTimer } from "./watch-stats"

export async function startSharedFunctions(site: RatingsSite) {
	watchSettings()
	listenForRatingsShortcut(site.service)
	startWatchTimer(site)
	watchLetterboxdProfile(refreshRowPresentation)

	await settingsReady
	await loadOverrides()
	await loadCache()
	startCards(site)
	startPageFeatures(site)
	// a corrected match, or the cache or fixes cleared from settings, here or in another tab: look everything up again
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !((changes.DBCache && !changes.DBCache.newValue) || changes.titleOverrides)) return
		episodeRatings.forget()
		forgetCards()
	})
}

let badgeRedrawTimer: ReturnType<typeof setTimeout> | undefined
// row filters and badge looks follow the settings as they change
function watchSettings() {
	watch(
		() => [
			settings.value.General.fadeWatched,
			settings.value.General.hideBelowRating,
			settings.value.General.dimBelowBand,
			settings.value.Netflix?.showRating,
			settings.value.Amazon?.showRating,
			settings.value.HBO?.showRating,
			settings.value.Disney?.showRating,
			settings.value.Crunchyroll?.showRating,
		],
		() => refreshRowPresentation(),
	)
	// badges read these when they're drawn, so redraw the ones on screen; settled first, as the glass slider fires per step
	watch(
		() => [
			settings.value.General.ratingSources,
			settings.value.General.friendsRatings,
			settings.value.General.friendsStyle,
			settings.value.General.badgeStyle,
			settings.value.General.badgeDetail,
			settings.value.General.glassFrost,
			settings.value.General.markWatched,
		],
		() => {
			clearTimeout(badgeRedrawTimer)
			badgeRedrawTimer = setTimeout(() => refreshRowPresentation(true), 150)
		},
	)
}

const episodeRatings = new EpisodeRatings(
	async (title, type, year) => {
		const entry = cached(title)
		if (
			entry &&
			isCacheCurrent(entry) &&
			(!type || entry.media_type === type) &&
			(!year || entry.release_date?.startsWith(year)) &&
			getDiffInDays(entry.date, new Date()) <= 1
		)
			return entry
		return lookupMovieInfo(title, type, year)
	},
	(data: FeatureRating, season): Promise<EpisodeRating[]> => fetchEpisodeRatings(data, season),
)

function startPageFeatures(site: RatingsSite) {
	const tick = () => {
		if (document.hidden) return
		episodeRatings
			.tick(SERVICES[site.service].feature, {
				episodes: settings.value.General.episodeRatings,
				sources: ratingSources(),
				look: badgeLook(settings.value.General),
			})
			.catch((error) => console.debug("streamBuddy page ratings:", error))
		updateSearchSorting()
		updateCreditsPrompt(site)
	}
	setInterval(tick, 1000)
	watch(
		() => [
			settings.value.General.episodeRatings,
			settings.value.General.searchSort,
			settings.value.General.rateOnCredits,
		],
		tick,
	)
	tick()
}

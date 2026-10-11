import { startSharedFunctions, Platforms } from "@/content-script/shared-functions"
import { prime } from "@/playback/sites/prime"
import { startPlayback, playbackStoreSettings as settings, playbackSettingsReady } from "@/playback/start"
import { keepTidy, tidyPrime } from "@/playback/tidy"

// Prime Video also lives on Amazon's shopping domains; only act on its pages
const isPrimeVideo =
	/primevideo/i.test(location.hostname) || /\/(gp\/video|video)\b/i.test(location.pathname) || /prime video/i.test(document.title)

if (isPrimeVideo) {
	startSharedFunctions(Platforms.Amazon)
	startPlayback(prime)
	playbackSettingsReady.then(() => {
		const tidy = keepTidy(() => tidyPrime(settings.value.Amazon.hidePaid))
		watch(() => settings.value.Amazon.hidePaid, tidy)
	})
}

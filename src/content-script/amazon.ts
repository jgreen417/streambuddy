import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { primeSite } from "@/content-script/sites/prime"
import { prime } from "@/playback/sites/prime"
import { startPlayback } from "@/playback/start"
import { settings, settingsReady } from "@/stores/settings"
import { keepTidy, tidyPrime } from "@/playback/tidy"

// Prime Video also lives on Amazon's shopping domains; only act on its pages
const isPrimeVideo =
	/primevideo/i.test(location.hostname) ||
	/\/(gp\/video|video)(\/|$)/i.test(location.pathname) ||
	// video detail pages on Amazon's own paths ("Watch The Boys | Prime Video"), not shopping results for "prime video"
	/\|\s*prime video\b/i.test(document.title)

if (isPrimeVideo) {
	listenForCreditsMarkers()
	startSharedFunctions(primeSite)
	startPlayback(prime)
	settingsReady.then(() => {
		const tidy = keepTidy(() => tidyPrime(settings.value.Amazon.hidePaid))
		watch(() => settings.value.Amazon.hidePaid, tidy)
	})
}

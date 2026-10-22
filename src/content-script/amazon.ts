import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { primeSite } from "@/content-script/sites/prime"
import { prime } from "@/playback/sites/prime"
import { startPlayback } from "@/playback/start"
import { settings, settingsReady } from "@/stores/settings"
import { keepTidy, quietPreviews, tidyPrime } from "@/playback/tidy"

// Prime Video also lives on Amazon's shopping domains; only act on its pages
const isPrimeVideo =
	/primevideo/i.test(location.hostname) ||
	/\/(gp\/video|video)(\/|$)/i.test(location.pathname) ||
	// video pages on Amazon's own paths ("Watch The Boys | Prime Video", "Amazon.fr : Films : Prime Video"), not a
	// shopping search for "prime video", whose title ends with the search words
	(/[|:]\s*prime video\s*$/i.test(document.title) &&
		!/prime video/i.test(new URLSearchParams(location.search).get("k") ?? ""))

if (isPrimeVideo) {
	listenForCreditsMarkers()
	startSharedFunctions(primeSite)
	startPlayback(prime)
	settingsReady.then(() => {
		const tidy = keepTidy(() => {
			tidyPrime(settings.value.Amazon.hidePaid)
			quietPreviews(settings.value.General.quietPreviews && !primeSite.isPlayerPage())
		})
		watch(() => [settings.value.Amazon.hidePaid, settings.value.General.quietPreviews], tidy)
	})
}

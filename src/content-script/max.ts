import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { maxSite } from "@/content-script/sites/max"
import { max } from "@/playback/sites/max"
import { startPlayback } from "@/playback/start"
import { settings, settingsReady } from "@/stores/settings"
import { keepTidy, quietPreviews, stopPreviews } from "@/content-script/tidy"

listenForCreditsMarkers()
startSharedFunctions(maxSite)
startPlayback(max)
settingsReady.then(() => {
	const tidy = keepTidy(() => {
		quietPreviews(settings.value.General.quietPreviews && !maxSite.isPlayerPage())
		stopPreviews(settings.value.General.stopPreviews, () => !maxSite.isPlayerPage())
	})
	watch(() => [settings.value.General.quietPreviews, settings.value.General.stopPreviews], tidy)
})

import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { maxSite } from "@/content-script/sites/max"
import { max } from "@/playback/sites/max"
import { startPlayback } from "@/playback/start"
import { settings, settingsReady } from "@/stores/settings"
import { keepTidy, quietPreviews } from "@/content-script/tidy"

listenForCreditsMarkers()
startSharedFunctions(maxSite)
startPlayback(max)
settingsReady.then(() => {
	const quiet = keepTidy(() => quietPreviews(settings.value.General.quietPreviews && !maxSite.isPlayerPage()))
	watch(() => settings.value.General.quietPreviews, quiet)
})

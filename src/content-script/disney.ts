import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { disneySite } from "@/content-script/sites/disney"
import { disney } from "@/playback/sites/disney"
import { startPlayback } from "@/playback/start"
import { settings, settingsReady } from "@/stores/settings"
import { keepTidy, quietPreviews } from "@/content-script/tidy"

listenForCreditsMarkers()
startSharedFunctions(disneySite)
startPlayback(disney)
settingsReady.then(() => {
	const quiet = keepTidy(() => quietPreviews(settings.value.General.quietPreviews && !disneySite.isPlayerPage()))
	watch(() => settings.value.General.quietPreviews, quiet)
})

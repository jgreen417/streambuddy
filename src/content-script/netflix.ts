import { startSharedFunctions } from "@/content-script/shared-functions"
import { netflixSite } from "@/content-script/sites/netflix"
import { netflix } from "@/playback/sites/netflix"
import { startPlayback } from "@/playback/start"
import { settings, settingsReady } from "@/stores/settings"
import { keepTidy, tidyNetflix } from "@/playback/tidy"

startSharedFunctions(netflixSite)
startPlayback(netflix)
settingsReady.then(() => {
	const tidy = keepTidy(() => tidyNetflix(settings.value.Netflix.hideGames))
	watch(() => settings.value.Netflix.hideGames, tidy)
})

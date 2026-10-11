import { startSharedFunctions, Platforms } from "@/content-script/shared-functions"
import { netflix } from "@/playback/sites/netflix"
import { startPlayback, playbackStoreSettings as settings, playbackSettingsReady } from "@/playback/start"
import { keepTidy, tidyNetflix } from "@/playback/tidy"

startSharedFunctions(Platforms.Netflix)
startPlayback(netflix)
playbackSettingsReady.then(() => {
	const tidy = keepTidy(() => tidyNetflix(settings.value.Netflix.hideGames))
	watch(() => settings.value.Netflix.hideGames, tidy)
})

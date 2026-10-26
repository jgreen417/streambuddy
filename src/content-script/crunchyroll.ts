import { startSharedFunctions } from "@/content-script/shared-functions"
import { crunchyrollSite } from "@/content-script/sites/crunchyroll"
import { crunchyroll } from "@/playback/sites/crunchyroll"
import { startPlayback } from "@/playback/start"

startSharedFunctions(crunchyrollSite)
startPlayback(crunchyroll)

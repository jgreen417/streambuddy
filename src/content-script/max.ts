import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { maxSite } from "@/content-script/sites/max"
import { hbo } from "@/playback/sites/hbo"
import { startPlayback } from "@/playback/start"

listenForCreditsMarkers()
startSharedFunctions(maxSite)
startPlayback(hbo)

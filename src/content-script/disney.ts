import { listenForCreditsMarkers } from "@/content-script/credits-marker"
import { startSharedFunctions } from "@/content-script/shared-functions"
import { disneySite } from "@/content-script/sites/disney"
import { disney } from "@/playback/sites/disney"
import { startPlayback } from "@/playback/start"

listenForCreditsMarkers()
startSharedFunctions(disneySite)
startPlayback(disney)

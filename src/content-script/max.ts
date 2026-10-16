import { startSharedFunctions } from "@/content-script/shared-functions"
import { maxSite } from "@/content-script/sites/max"
import { hbo } from "@/playback/sites/hbo"
import { startPlayback } from "@/playback/start"

startSharedFunctions(maxSite)
startPlayback(hbo)

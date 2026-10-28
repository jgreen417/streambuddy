import { startSharedFunctions } from "@/content-script/shared-functions"
import { tubiSite } from "@/content-script/sites/tubi"
import { tubi } from "@/playback/sites/tubi"
import { startPlayback } from "@/playback/start"

startSharedFunctions(tubiSite)
startPlayback(tubi)

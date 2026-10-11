import { startSharedFunctions, Platforms } from "@/content-script/shared-functions"
import { hbo } from "@/playback/sites/hbo"
import { startPlayback } from "@/playback/start"

startSharedFunctions(Platforms.HBO)
startPlayback(hbo)

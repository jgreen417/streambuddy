import { PlaybackEngine } from "./engine"
import { playbackSettings } from "./settings"
import type { SiteAdapter } from "./types"
import { settings, settingsReady } from "@/stores/settings"

export async function startPlayback(site: SiteAdapter) {
	await settingsReady
	const engine = new PlaybackEngine(site, () => playbackSettings(settings.value, site.service))
	await engine.start()
	return settings
}

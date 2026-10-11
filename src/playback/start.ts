import { PlaybackEngine } from "./engine"
import { playbackSettings } from "./settings"
import type { SiteAdapter } from "./types"

const { data: settings, promise } = useBrowserSyncStorage<settingsType>("settings", defaultSettings)

export async function startPlayback(site: SiteAdapter) {
	await promise
	const engine = new PlaybackEngine(site, () => playbackSettings(settings.value, site.service))
	await engine.start()
	return settings
}
export { settings as playbackStoreSettings, promise as playbackSettingsReady }

import { useBrowserSyncStorage } from "@/composables/useBrowserStorage"
import { defaultSettings, type settingsType } from "./storeTypes"

// The stored settings, one 8KB sync-storage item. One copy per page (popup, options page, or a streaming tab's
// content scripts), kept in step with the others through storage events.
export const { data: settings, promise: settingsReady } = useBrowserSyncStorage<settingsType>(
	"settings",
	defaultSettings,
)

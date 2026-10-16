// The settings as this tab sees them, kept in step with the popup and the options page
export const { data: settings, promise: settingsReady } = useBrowserSyncStorage<settingsType>(
	"settings",
	defaultSettings,
)

export const ratingSources = () => settings.value.General.ratingSources

export const locale = () => document.documentElement.lang || navigator?.language || "en-US"

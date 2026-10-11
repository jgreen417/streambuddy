import type { PlaybackSettings, ServiceKey } from "./types"

// the playback engine's view of the stored settings for one service
export function playbackSettings(settings: settingsType, service: ServiceKey): PlaybackSettings {
	const s = settings[service]
	const g = settings.General
	return {
		skip: {
			intro: s.skipIntro,
			recap: s.skipRecap,
			credits: s.skipCredits,
			stillWatching: s.skipStillWatching,
		},
		skipAds: s.skipAd,
		speedControl: s.speedControl,
		keepFirstIntro: g.keepFirstIntro,
		notices: g.skipNotices,
		pauseAfter: g.pauseAfter,
	}
}

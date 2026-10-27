import type { settingsType } from "@/stores/storeTypes"
import type { StreamingService } from "@/constants/streamingServices"
import type { PlaybackSettings } from "./types"

// the playback engine's view of the stored settings for one service
export function playbackSettings(settings: settingsType, service: StreamingService): PlaybackSettings {
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
		keepSeasonRecaps: g.keepSeasonRecaps,
		returnReminders: g.returnReminders,
		skipDelaySeconds: g.skipDelaySeconds,
		notices: g.skipNotices,
		pauseAfter: g.pauseAfter,
	}
}

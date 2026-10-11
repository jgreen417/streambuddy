// What a streaming site has to tell the playback engine. Everything site-specific lives in an adapter
// (sites/*.ts); the engine, toasts, speed control and rules are shared.

// intro, recap and credits are skip buttons the site shows; stillWatching is the "Are you still watching?" prompt
export type SkipKind = "intro" | "recap" | "credits" | "stillWatching"
export type ServiceKey = "Netflix" | "Amazon" | "HBO"

export type SiteAdapter = {
	service: ServiceKey
	// the main feature video, or null when not on a player page
	video(): HTMLVideoElement | null
	// the element that fills the screen while playing, so overlays stay visible in fullscreen
	playerRoot(): HTMLElement | null
	skipButton(kind: SkipKind): HTMLElement | null
	// seconds of ad left, or null when no ad is playing
	adRemaining?(): number | null
	// how the site lets an ad be passed: some players allow seeking past it, others only fast playback
	adStrategy?: "seek" | "fastForward"
	// identifies the episode being played, so per-episode state resets when it changes
	episodeKey(): string | null
	episodeNumber(): number | null
	// the series (or film) title, used for per-show rules
	showTitle(): string | null
}

export type PlaybackSettings = {
	skip: Record<SkipKind, boolean>
	skipAds: boolean
	speedControl: boolean
	keepFirstIntro: boolean
	notices: boolean
	// pause after this many episodes play back to back without the viewer touching anything; 0 = off
	pauseAfter: number
}

// per-show exceptions, keyed by normalised show title: { "the bear": ["intro"] }
export type SkipRules = Record<string, SkipKind[]>

export const SKIP_LABELS: Record<SkipKind | "ad", string> = {
	intro: "intro",
	recap: "recap",
	credits: "credits",
	stillWatching: "“Still watching?”",
	ad: "ad",
}

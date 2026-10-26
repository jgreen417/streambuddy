// What a streaming site has to tell the playback engine. Everything site-specific lives in an adapter
// (sites/*.ts); the engine, toasts, speed control and rules are shared.
import type { StreamingService } from "@/constants/streamingServices"
import type { PlayerClock } from "@/utils/credits-review"

// intro, recap and credits are skip buttons the site shows; stillWatching is the "Are you still watching?" prompt
export type SkipKind = "intro" | "recap" | "credits" | "stillWatching"

export type SiteAdapter = {
	service: StreamingService
	// the main feature video, or null when not on a player page
	video(): HTMLVideoElement | null
	// where the title is up to, where the <video>'s own clock isn't the title's (Disney+'s has no length)
	clock?(): PlayerClock | null
	// the element that fills the screen while playing, so overlays stay visible in fullscreen
	playerRoot(): HTMLElement | null
	// what the eye follows across the player's own top bar (its back button, or its title), for streamBuddy's pills to
	// sit level with
	topBarAnchor?(): HTMLElement | null
	skipButton(kind: SkipKind): HTMLElement | null
	// seconds of ad left, or null when no ad is playing
	adRemaining?(): number | null
	// how the site lets an ad be passed: some players allow seeking past it, others only fast playback
	adStrategy?: "seek" | "fastForward"
	// true when the player treats a seek on its <video> as tampering and stops playback (Netflix, error
	// F7375): skips then only press the site's own buttons, with no Undo
	seekBlocked?: boolean
	// ms after a skip button is pressed before the player has jumped, where it's slower than usual
	skipLandsMs?: number
	// identifies the episode being played, so per-episode state resets when it changes
	episodeKey(): string | null
	episodeNumber(): number | null
	// the season the playing episode belongs to, where the player labels it
	episodeSeason?(): number | null
	// the series (or film) title, used for per-show rules
	showTitle(): string | null
	// true when the player already has its own speed menu: streamBuddy then only remembers the speed and
	// adds shortcuts, instead of drawing a second control
	hasNativeSpeedControl?(): boolean
}

export type PlaybackSettings = {
	skip: Record<SkipKind, boolean>
	skipAds: boolean
	speedControl: boolean
	keepFirstIntro: boolean
	// hear the recap when a season starts
	keepSeasonRecaps: boolean
	// wait this many seconds after a skip control appears before pressing it; 0 = press at once
	skipDelaySeconds: number
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

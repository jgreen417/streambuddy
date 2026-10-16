// What the ratings features (card badges, search sorting, episode chips, the review pill and watch stats) need to know
// about a streaming site. Everything site-specific lives in an adapter (sites/*.ts); shared-functions.ts is the same
// on every service. The playback engine has its own adapters in playback/sites/.
import type { StreamingService } from "@/constants/streamingServices"
import type { NetflixCredits } from "@/utils/netflix-credits"
import type { PlayingEpisode } from "@/utils/series-finale"

export type MediaType = "tv" | "movie" | null

// where a card's badge goes: the box it's appended to and the corner of the artwork it sits in
export type BadgeHost = {
	host: HTMLElement
	corner: "top" | "bottom"
	// a bottom badge sits this fraction of the artwork's height higher (Prime's channel logo)
	raise?: number
	// false when there's no artwork to line the badge up with, so it keeps its default offsets
	fit?: boolean
}

export type RatingsSite = {
	service: StreamingService
	// the badge's starting position until it's fitted to the artwork, and its stacking over the card
	badge: { corner: "top" | "bottom"; right?: string; zIndex: string }
	// the cards to rate, one list per kind of card: the kind is passed back to cleanTitle and seenMarker
	titleCards(): Array<NodeListOf<Element>>
	// the element that carries the "already picked up" class for a card of that kind
	seenMarker(card: HTMLElement, kind: number): HTMLElement | null
	cleanTitle(card: HTMLElement, kind: number): string | undefined
	mediaType(card: HTMLElement, url: string): MediaType
	// true while a card's title is still being worked out elsewhere, so it's picked up again on a later pass
	titlePending?(card: HTMLElement): boolean
	// false on pages that list titles which aren't recommendations (Prime's extras and trailers)
	ratesCards?(): boolean
	badgeHost(card: HTMLElement): BadgeHost | null
	// the element hidden or faded along with the card by the row filters
	rowItem(card: HTMLElement): HTMLElement
	searchGrids(): HTMLElement[]
	isPlayerPage(): boolean
	// the service's own metadata for what's playing, when it marks its credits
	creditsMetadata?(): NetflixCredits | undefined
	// the raw title of what's playing, before the shared clean-up
	playingTitle(metadata: NetflixCredits | undefined): string | null | undefined
	// undefined for a film, null for an episode that isn't a limited series' finale (or can't be placed in its show)
	playingEpisode(metadata: NetflixCredits | undefined): PlayingEpisode | null | undefined
	// the service's end screen is up, which it shows when the credits start
	endScreenShowing(video: HTMLVideoElement): boolean
	// moves the review pill clear of the service's own end-of-film controls
	placeReview(review: HTMLElement): void
}

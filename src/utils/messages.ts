// The messages the content scripts and the popup send to the background, with what each one answers. Both ends are
// type-checked against this, so a changed payload or reply is a compile error instead of a silent undefined.
import type { ProtocolWithReturn } from "webext-bridge"
import type { ExternalRating, ImdbEpisodeRating, LetterboxdFilm, LetterboxdProfile } from "./ratings"

// a temporary failure the caller must not cache
export type LookupError = { error: string }
export type FetchRequestType = "tmdb" | "noAuth"

declare module "webext-bridge" {
	export interface ProtocolMap {
		letterboxdPrefetch: ProtocolWithReturn<{ title: string; friends: boolean }, void>
		// null: Letterboxd has no rating for this film
		letterboxdRating: ProtocolWithReturn<
			{ tmdbId: number; friends: boolean; title?: string },
			LetterboxdFilm | null | LookupError
		>
		// a show's page, which only limited series have
		letterboxdSeries: ProtocolWithReturn<{ imdbId: string; friends: boolean }, LetterboxdFilm | null | LookupError>
		imdbRating: ProtocolWithReturn<{ imdbId: string }, ExternalRating | null | LookupError>
		imdbEpisodes: ProtocolWithReturn<{ imdbId: string; season: number }, ImdbEpisodeRating[] | LookupError>
		openAccountSetup: ProtocolWithReturn<Record<string, never>, void>
		letterboxdProfile: ProtocolWithReturn<{ force?: boolean }, LetterboxdProfile | null | LookupError>
		// the JSON at url, with the API key for type added by the background
		fetch: ProtocolWithReturn<{ url: string; type: FetchRequestType }, unknown>
	}
}

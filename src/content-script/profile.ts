// The user's Letterboxd diary and watchlist (synced by the background every few hours)
import { sendMessage } from "webext-bridge/content-script"
import { getAccount, onAccountChanged } from "@/utils/account"
import { isLookupError } from "@/utils/lookup"
import { getLetterboxdSlug, type LetterboxdProfile, type RatingSource } from "@/utils/ratings"
import { settings } from "./settings"

let profile: LetterboxdProfile | null = null
let watchlistSlugs = new Set<string>()
// entered during onboarding; read once at startup and kept current if the user changes it
let username = ""
let onChange = () => {}

function setProfile(next: LetterboxdProfile | null) {
	profile = next
	watchlistSlugs = new Set(next?.watchlist)
	onChange()
}
// changed: called whenever the profile changes, so what reads it can redraw
export function watchLetterboxdProfile(changed: () => void) {
	onChange = changed
	onAccountChanged((account) => {
		if (account.letterboxdUsername === username) return
		setProfile(null)
		loadProfile()
	})
	browser.storage.onChanged.addListener((changes, areaName) => {
		const next = changes.letterboxdProfile?.newValue as LetterboxdProfile | undefined
		if (areaName === "local" && next?.username === username) setProfile(next)
	})
	loadProfile()
}
async function loadProfile() {
	username = (await getAccount()).letterboxdUsername
	if (!username) return
	Promise.resolve(sendMessage("letterboxdProfile", {}, "background"))
		.then((next) => {
			if (next && !isLookupError(next)) setProfile(next)
		})
		.catch(() => {})
}

export const letterboxdUsername = () => username

type Rated = { source: RatingSource; rating_url?: string }
const slugOf = (data: Rated) => (data.source === "letterboxd" ? getLetterboxdSlug(data.rating_url) : undefined)

// your Letterboxd rating of the title (0 when logged without one); undefined when you haven't logged it.
// sameAccount: only from the profile of the account entered now, not one still loaded from before a change
export function loggedRating(data: Rated, sameAccount = false) {
	const slug = slugOf(data)
	if (!slug || (sameAccount && profile?.username !== username)) return undefined
	return profile?.watched[slug]
}

export type PersonalStatus = { watched?: number; watchlist: boolean }
export function getPersonalStatus(data: Rated): PersonalStatus {
	const slug = slugOf(data)
	if (!slug || !profile || !settings.value.General.markWatched) return { watchlist: false }
	return { watched: profile.watched[slug], watchlist: watchlistSlugs.has(slug) }
}

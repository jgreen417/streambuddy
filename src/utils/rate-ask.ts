// Asking for a store rating: once at the top of the popup after a few days of watching, once on the credits card
// after a few films logged from it, and a link in settings for anyone looking. Opening the link ends every ask.
import { CHROME_REVIEWS_URL, FIREFOX_REVIEWS_URL } from "@/constants/links"

const onFirefox = browser.runtime.getURL("").startsWith("moz-extension:")
export const storeName = onFirefox ? "Firefox Add-ons" : "the Chrome Web Store"
export const reviewsUrl = onFirefox ? FIREFOX_REVIEWS_URL : CHROME_REVIEWS_URL

export const POPUP_ASK_DAYS = 5
export const CARD_ASK_FILMS = 3

export type RateAsk = {
	rateLinkOpened?: boolean
	ratePopupDismissed?: boolean
	rateCardShown?: boolean
	// films opened on Letterboxd from the credits card
	filmsLogged?: number
}
const KEYS: (keyof RateAsk)[] = ["rateLinkOpened", "ratePopupDismissed", "rateCardShown", "filmsLogged"]

export const loadRateAsk = () => browser.storage.local.get(KEYS) as Promise<RateAsk>
export const saveRateAsk = (change: RateAsk) => browser.storage.local.set(change)

// kept current across tabs, for the credits card, which decides as it draws
export function watchRateAsk(state: RateAsk) {
	loadRateAsk().then((stored) => Object.assign(state, stored))
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return
		for (const key of KEYS) if (key in changes) Object.assign(state, { [key]: changes[key].newValue })
	})
}

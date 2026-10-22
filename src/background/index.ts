import { request as networkRequest, readJson } from "@/utils/network"
import { debugLog, logLookupFailure } from "@/utils/log"
import { BUILT_IN_TMDB_TOKEN, getAccount, onAccountChanged, setBuiltInKeyRejected, tmdbRequest } from "@/utils/account"
import { createProfileSync } from "@/utils/profile-sync"
import { onMessage } from "webext-bridge/background"
import { UNINSTALL_SURVEY_URL } from "@/constants/links"
import type { FetchRequestType, LookupError } from "@/utils/messages"
import {
	fetchImdbRating,
	fetchImdbEpisodes,
	fetchLetterboxdGuess,
	fetchLetterboxdProfile,
	fetchLetterboxdByImdb,
	fetchLetterboxdRating,
	guessLetterboxdSlug,
	type ImdbEpisodeRating,
	type LetterboxdFilm,
	type LetterboxdProfile,
} from "@/utils/ratings"
const is_DEV = process.env.NODE_ENV === "development"

// first install: open the two-step welcome page. An update leaves a "what's new" note for the popup.
browser.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
	if (is_DEV) return
	const { version } = browser.runtime.getManifest()
	if (reason === "update" && previousVersion !== version) browser.storage.local.set({ whatsNew: version })
	if (reason !== "install") return
	await browser.storage.local.clear()
	browser.tabs.create({
		active: true,
		url: browser.runtime.getURL("src/ui/options-page/index.html#/options-page/install"),
	})
})

// an empty URL also clears one an earlier version registered
browser.runtime.setUninstallURL(UNINSTALL_SURVEY_URL)
debugLog("background loaded")

// A homepage can ask for dozens of titles at once and Letterboxd copes fine (40 parallel requests finish in ~1.3s).
// Benchmarked on a 40-card homepage, a cap of 8 made badges slower than no cap (1.44s vs 0.90s average) and 32 was
// within noise of uncapped (0.92s). The cap stays at 8 so a page of cards never floods Letterboxd; the cache absorbs
// repeat visits.
const MAX_LETTERBOXD_LOOKUPS = 8
let activeLetterboxdLookups = 0
const waitingLetterboxdLookups: Array<() => void> = []
async function withLetterboxdSlot<T>(task: () => Promise<T>): Promise<T> {
	if (activeLetterboxdLookups >= MAX_LETTERBOXD_LOOKUPS)
		await new Promise<void>((resolve) => waitingLetterboxdLookups.push(resolve))
	activeLetterboxdLookups++
	try {
		return await task()
	} finally {
		activeLetterboxdLookups--
		waitingLetterboxdLookups.shift()?.()
	}
}

// Speculative lookups: the content script sends the card's title as soon as it sees it, and the guessed
// Letterboxd page (plus friends) downloads while TMDb is searching. Kept for 30s for the real request to claim.
const guesses = new Map<string, Promise<LetterboxdFilm | null>>()
const guessKey = (title: string, friends: boolean) => `${guessLetterboxdSlug(title)}|${friends}`
onMessage("letterboxdPrefetch", (message) => {
	const slug = guessLetterboxdSlug(message.data.title)
	const key = guessKey(message.data.title, message.data.friends)
	if (!slug || guesses.has(key)) return
	const pending = getAccount().then(({ letterboxdUsername }) =>
		withLetterboxdSlot(() => fetchLetterboxdGuess(slug, message.data.friends ? letterboxdUsername : "")),
	)
	guesses.set(
		key,
		pending.catch(() => null),
	)
	setTimeout(() => guesses.delete(key), 30_000)
})

// null = no rating for this title; { error } = temporary failure the caller shouldn't cache
onMessage("letterboxdRating", async (message) => {
	const { tmdbId, friends, title } = message.data
	try {
		// use the guessed page only if Letterboxd says it is this exact TMDb film
		const guess = title ? await guesses.get(guessKey(title, friends)) : null
		if (guess?.tmdb?.id === tmdbId && guess.tmdb.type === "movie") return guess
		const username = friends ? (await getAccount()).letterboxdUsername : ""
		return await withLetterboxdSlot(() => fetchLetterboxdRating(tmdbId, username))
	} catch (error) {
		logLookupFailure("streamBuddy lookup failed:", error)
		return { error: (error as Error).message }
	}
})
// a show's Letterboxd page, if it has one: only limited series do
onMessage("letterboxdSeries", async (message) => {
	try {
		const username = message.data.friends ? (await getAccount()).letterboxdUsername : ""
		return await withLetterboxdSlot(() => fetchLetterboxdByImdb(message.data.imdbId, username))
	} catch (error) {
		logLookupFailure("streamBuddy lookup failed:", error)
		return { error: (error as Error).message }
	}
})
onMessage("imdbRating", async (message) => {
	try {
		return await fetchImdbRating(message.data.imdbId)
	} catch (error) {
		logLookupFailure("streamBuddy lookup failed:", error)
		return { error: (error as Error).message }
	}
})

const episodeLookups = new Map<string, { expires: number; pending: Promise<ImdbEpisodeRating[] | LookupError> }>()
onMessage("imdbEpisodes", async (message) => {
	const { imdbId, season } = message.data
	const key = `${imdbId}|${season}`
	const cached = episodeLookups.get(key)
	if (cached && cached.expires > Date.now()) return cached.pending
	const pending = fetchImdbEpisodes(imdbId, season).catch((error) => {
		episodeLookups.delete(key)
		return { error: (error as Error).message }
	})
	episodeLookups.set(key, { expires: Date.now() + 6 * 60 * 60 * 1000, pending })
	return pending
})

// Sideloaded build: an unpacked extension reads its files from disk, so a rebuild shows up in build-id.txt
// straight away. Reload within ~30s of `npm run build:chrome` instead of needing a click in the extensions page.
async function reloadIfRebuilt() {
	try {
		const response = await fetch(browser.runtime.getURL("build-id.txt"), { cache: "no-store" })
		const buildId = (await response.text()).trim()
		if (response.ok && buildId && buildId !== __BUILD_ID__) browser.runtime.reload()
	} catch {
		// no build-id.txt (e.g. a dev build): nothing to compare against
	}
}
if (__SIDELOAD__) {
	browser.alarms.create("streambuddy-build-check", { periodInMinutes: 0.5 })
	browser.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name === "streambuddy-build-check") reloadIfRebuilt()
	})
	reloadIfRebuilt()
}

// The user's diary and watchlist, refreshed at most every 6 hours (or when the popup asks)
const syncLetterboxdProfile = createProfileSync(async () => (await getAccount()).letterboxdUsername, {
	read: async () => {
		const { letterboxdProfile } = await browser.storage.local.get("letterboxdProfile")
		return letterboxdProfile as LetterboxdProfile | undefined
	},
	fetch: async () => fetchLetterboxdProfile((await getAccount()).letterboxdUsername),
	write: async (profile) => {
		await browser.storage.local.set({ letterboxdProfile: profile })
	},
})
// the credits review's "Connect" button: open settings at the Letterboxd account step
onMessage("openAccountSetup", () => {
	browser.tabs.create({ url: browser.runtime.getURL("src/ui/options-page/index.html#/options-page/Account") })
})
onMessage("letterboxdProfile", async (message) => syncLetterboxdProfile(!!message.data?.force))

// a key or username saved on the settings page takes effect here straight away, not on the next worker restart
onAccountChanged(() => {})

// API keys only ever go to the API they belong to, whatever URL a content script asks for
const AUTH_HOSTS: Partial<Record<FetchRequestType, string>> = {
	tmdb: "api.themoviedb.org",
}

onMessage("fetch", async (message) => {
	const { data } = message
	try {
		let headers: Record<string, string>
		let usesBuiltInKey = false
		if (data.type === "noAuth") {
			headers = {
				accept: "application/json",
			}
		} else if (data.type === "tmdb") {
			const { tmdbToken } = await getAccount()
			// not set up yet: a permanent condition, so say so instead of looking like a network blip
			if (!tmdbToken) return { error: "setup-required" }
			usesBuiltInKey = !!BUILT_IN_TMDB_TOKEN && tmdbToken === BUILT_IN_TMDB_TOKEN
			const request = tmdbRequest(data.url, tmdbToken)
			headers = request.headers
			data.url = request.url
		} else {
			throw new Error(`Unknown fetch type: ${data.type}`)
		}
		const authHost = AUTH_HOSTS[data.type]
		if (authHost && new URL(data.url).hostname !== authHost)
			throw new Error(`Refusing to send ${data.type} credentials to ${new URL(data.url).hostname}`)
		return await networkRequest(
			data.url,
			async (response) => {
				if (usesBuiltInKey)
					void setBuiltInKeyRejected(response.status === 401 || response.status === 403).catch(() => {})
				// rate limits and outages are temporary: report them rather than handing back an error body as "no results"
				if (!response.ok && response.status !== 404) return { error: `HTTP ${response.status}` }
				return readJson(response)
			},
			{ method: "GET", headers },
		)
	} catch (error) {
		logLookupFailure("streamBuddy lookup failed:", error)
		return { error: (error as Error).message }
	}
})

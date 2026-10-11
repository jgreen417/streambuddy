import { getAccount, tmdbRequest } from "@/utils/account"
import { createProfileSync } from "@/utils/profile-sync"
// Sample code if using extensionpay.com
// import { extPay } from '@/utils/payment/extPay'
// extPay.startBackground()
const is_DEV = process.env.NODE_ENV === "development"

async function migrateHideTitlesToHiddenTitles() {
	const { hideTitles } = await browser.storage.sync.get("hideTitles")
	if (!hideTitles || typeof hideTitles !== "object" || Object.keys(hideTitles).length === 0) return

	const { hiddenTitles } = await browser.storage.local.get("hiddenTitles")
	const migrated: HiddenTitles = { ...(hiddenTitles ?? {}) }
	const today = new Date().toISOString().split("T")[0]
	for (const title of Object.keys(hideTitles)) {
		if (!migrated[title]) {
			migrated[title] = { platform: "Unknown", mediaType: null, posterPath: null, dateAdded: today }
		}
	}
	await browser.storage.local.set({ hiddenTitles: migrated })
	await browser.storage.sync.remove("hideTitles")
	console.log("migrated hideTitles to hiddenTitles", migrated)
}

browser.runtime.onInstalled.addListener(async (opt) => {
	// await browser.storage.local.clear()
	// await browser.storage.sync.clear()
	// Check if reason is install or update. Eg: opt.reason === 'install' // If extension is installed.
	if (opt.reason === "install" && !is_DEV) {
		await browser.storage.local.clear()
		browser.tabs.create({
			active: true,
			// Open the setup page and append `?type=install` to the URL so frontend
			// can know if we need to show the install page or update page.
			url: browser.runtime.getURL("src/ui/options-page/index.html#/options-page/install"),
		})
	}

	if (opt.reason === "update") {
		await migrateHideTitlesToHiddenTitles()
	}

	if (opt.reason === "update" && is_DEV) {
		// browser.tabs.create({
		// 	active: true,
		// 	url: browser.runtime.getURL("src/ui/options-page/index.html#/options-page/install"),
		// 	// url: browser.runtime.getURL("src/ui/action-popup/index.html#/action-popup"),
		// })
		// browser.tabs.create({
		// 	active: true,
		// 	url: browser.runtime.getURL("src/ui/action-popup/index.html#/"),
		// 	// url: browser.runtime.getURL("src/ui/action-popup/index.html#/action-popup"),
		// })
	}
})

self.onerror = function (message, source, lineno, colno, error) {
	console.info("Error: " + message)
	console.info("Source: " + source)
	console.info("Line: " + lineno)
	console.info("Column: " + colno)
	console.info("Error object: " + error)
}

import { onMessage } from "webext-bridge/background"
import { addLetterboxdWatchlist } from "@/utils/letterboxd-actions"
import {
	fetchImdbRating,
	fetchImdbEpisodes,
	fetchLetterboxdGuess,
	fetchLetterboxdProfile,
	fetchLetterboxdRating,
	guessLetterboxdSlug,
	type LetterboxdFilm,
	type LetterboxdProfile,
} from "@/utils/ratings"
console.log("background loaded")

const Badges: { [key: string]: string | number } = {}
const isMobile = /Android/i.test(navigator.userAgent)
const isFirefox = !!browser?.webRequest
const action = browser.action || browser.browserAction
action.setBadgeBackgroundColor({ color: "#e60010" })
// Increases Badge by 1
async function increaseBadge(tabId: number) {
	if (Badges?.[tabId] === undefined || typeof Badges[tabId] !== "number") {
		Badges[tabId] = 0
	}
	Badges[tabId]++
	console.log("increaseBadge")
	action.setBadgeText({ text: Badges[tabId].toString(), tabId })
}
// Set Badge to a specific value
async function setBadgeText(text: string, tabId: number) {
	Badges[tabId] = text
	action.setBadgeText({ text, tabId })
}

// A homepage can ask for dozens of titles at once and Letterboxd copes fine (40 parallel requests finish in ~1.3s).
// Benchmarked on a 40-card homepage: a cap of 8 made badges slower than no cap (1.44s vs 0.90s average),
// 32 is within noise of uncapped (0.92s) while still stopping a huge grid from flooding the site.
// kept modest so a page of cards never floods Letterboxd; the cache absorbs repeat visits
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
onMessage("letterboxdPrefetch", (message: { data: { title: string; friends: boolean } }) => {
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
onMessage("letterboxdRating", async (message: { data: { tmdbId: number; friends: boolean; title?: string } }) => {
	const { tmdbId, friends, title } = message.data
	try {
		// use the guessed page only if Letterboxd says it is this exact TMDb film
		const guess = title ? await guesses.get(guessKey(title, friends)) : null
		if (guess?.tmdb?.id === tmdbId && guess.tmdb.type === "movie") return guess
		const username = friends ? (await getAccount()).letterboxdUsername : ""
		return await withLetterboxdSlot(() => fetchLetterboxdRating(tmdbId, username))
	} catch (error) {
		console.error(error)
		return { error: (error as Error).message }
	}
})
onMessage("imdbRating", async (message: { data: { imdbId: string } }) => {
	try {
		return await fetchImdbRating(message.data.imdbId)
	} catch (error) {
		console.error(error)
		return { error: (error as Error).message }
	}
})

const episodeLookups = new Map<string, { expires: number; pending: Promise<unknown> }>()
onMessage("imdbEpisodes", async (message: { data: { imdbId: string; season: number } }) => {
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

onMessage("letterboxdAddWatchlist", async (message: { data: { slug: string; confirmed: boolean } }) => {
	try {
		await addLetterboxdWatchlist(message.data.slug, message.data.confirmed)
		const { letterboxdProfile } = await browser.storage.local.get("letterboxdProfile")
		if (letterboxdProfile) {
			const profile = letterboxdProfile as LetterboxdProfile
			// The signed-in account can differ from the configured public-profile username.
			// Mark the profile stale instead of inserting a film into the wrong account's cache.
			profile.fetchedAt = 0
			await browser.storage.local.set({ letterboxdProfile: profile })
		}
		return { success: true }
	} catch (error) {
		return { error: (error as Error).message }
	}
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
onMessage("letterboxdProfile", async (message: { data: { force?: boolean } }) =>
	syncLetterboxdProfile(!!message.data?.force),
)

type FetchRequestType = "tmdb" | "noAuth"
// API keys only ever go to the API they belong to, whatever URL a content script asks for
const AUTH_HOSTS: Partial<Record<FetchRequestType, string>> = {
	tmdb: "api.themoviedb.org",
}

// onMessage
onMessage("fetch", async (message: { data: { url: string; type: FetchRequestType } }) => {
	const { data } = message
	try {
		let headers: Record<string, string>
		if (data.type === "noAuth") {
			headers = {
				accept: "application/json",
			}
		} else if (data.type === "tmdb") {
			const { tmdbToken } = await getAccount()
			// not set up yet: a permanent condition, so say so instead of looking like a network blip
			if (!tmdbToken) return { error: "setup-required" }
			const request = tmdbRequest(data.url, tmdbToken)
			headers = request.headers
			data.url = request.url
		} else {
			throw new Error(`Unknown fetch type: ${data.type}`)
		}
		const authHost = AUTH_HOSTS[data.type]
		if (authHost && new URL(data.url).hostname !== authHost)
			throw new Error(`Refusing to send ${data.type} credentials to ${new URL(data.url).hostname}`)
		const response = await fetch(data.url, {
			method: "GET",
			headers,
		})
		// rate limits and outages are temporary: report them rather than handing back an error body as "no results"
		if (!response.ok && response.status !== 404) return { error: `HTTP ${response.status}` }
		const responseData = await response.json()
		return responseData
	} catch (error) {
		console.error(error)
		return { error: (error as Error).message }
	}
})
onMessage("setBadgeText", async (message: { sender: any; data: { text: string } }) => {
	const { sender, data } = message
	if (sender?.tabId) setBadgeText(data.text, sender.tabId)
})
onMessage("increaseBadge", async (message: { sender: any }) => {
	const { sender } = message
	if (sender?.tabId) increaseBadge(sender.tabId)
})
onMessage("resetBadge", async (message: { sender: any }) => {
	const { sender } = message
	if (sender?.tabId) {
		if (Badges[sender.tabId]) delete Badges[sender.tabId]
		action.setBadgeText({ text: "", tabId: sender.tabId })
	}
})
if (isFirefox && isMobile) {
	// mobile section
	const { data: settings, promise } = useBrowserSyncStorage<settingsType>("settings", defaultSettings)
	ChangeUserAgent()

	const newUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0 streamingEnhanced"
	function ReplaceUserAgent(details: any) {
		if (settings.value.Video.userAgent) {
			for (const header of details.requestHeaders) {
				if (header.name === "User-Agent") {
					header.value = newUa
					break
				}
			}
		}
		return { requestHeaders: details.requestHeaders }
	}

	async function ChangeUserAgent() {
		await promise
		browser.webRequest.onBeforeSendHeaders.addListener(
			ReplaceUserAgent,
			{
				urls: [
					"*://*.disneyplus.com/*",
					"*://*.starplus.com/*",
					"*://*.max.com/*",
					"*://*.hbomax.com/*",
					// these are only the prime video urls
					"*://*.primevideo.com/*",
					"*://*.amazon.com/gp/video/*",
					"*://*.amazon.co.jp/gp/video/*",
					"*://*.amazon.de/gp/video/*",
					"*://*.amazon.co.uk/gp/video/*",
				],
			},
			["blocking", "requestHeaders"],
		)
	}
}

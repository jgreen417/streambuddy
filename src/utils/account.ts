import { request } from "./network"
// The user's Letterboxd username and TMDb key, entered during onboarding. Store builds ship streamBuddy's own
// TMDb key (from the release secret), so ratings work straight after install; a key the user adds replaces it.
// A sideloaded dev build falls back to the values in .env.
export type Account = {
	letterboxdUsername: string
	// the key lookups use: the user's own, else the built-in one
	tmdbToken: string
	// only what the user entered themselves
	ownTmdbToken: string
}
type StoredAccount = { letterboxdUsername?: string; tmdbToken?: string }

const STORAGE_KEY = "streambuddyAccount"
export const BUILT_IN_TMDB_TOKEN: string = __TMDB_TOKEN__
const BUILD_DEFAULTS = { letterboxdUsername: __LETTERBOXD_USERNAME__, tmdbToken: BUILT_IN_TMDB_TOKEN }

function normalize(stored: StoredAccount | undefined): Account {
	const ownTmdbToken = (stored?.tmdbToken ?? "").trim()
	return {
		letterboxdUsername: (stored?.letterboxdUsername ?? "").trim() || BUILD_DEFAULTS.letterboxdUsername,
		tmdbToken: ownTmdbToken || BUILD_DEFAULTS.tmdbToken,
		ownTmdbToken,
	}
}

let cached: Promise<Account> | null = null
export function getAccount(): Promise<Account> {
	cached ??= Promise.resolve()
		.then(() => browser.storage.sync.get(STORAGE_KEY))
		.then((result) => normalize(result?.[STORAGE_KEY] as StoredAccount | undefined))
		.catch(() => normalize(undefined))
	return cached
}

export async function saveAccount(changes: StoredAccount): Promise<Account> {
	const { [STORAGE_KEY]: stored } = await browser.storage.sync.get(STORAGE_KEY)
	const next = { ...(stored as StoredAccount | undefined), ...changes }
	await browser.storage.sync.set({ [STORAGE_KEY]: next })
	cached = Promise.resolve(normalize(next))
	return cached
}

export function onAccountChanged(callback: (account: Account) => void) {
	browser.storage?.onChanged?.addListener((changes, area) => {
		if (area !== "sync" || !changes[STORAGE_KEY]) return
		cached = Promise.resolve(normalize(changes[STORAGE_KEY].newValue as StoredAccount | undefined))
		cached.then(callback)
	})
}

export const isSetUp = (account: Account) => !!account.tmdbToken

// TMDb turned the built-in key away (revoked, or over its limits): every user without their own key is affected,
// so the popup asks for one instead of leaving the pages silently empty. Cleared once a lookup works again.
const KEY_REJECTED = "tmdbKeyRejected"
export async function setBuiltInKeyRejected(rejected: boolean) {
	const { [KEY_REJECTED]: current } = await browser.storage.local.get(KEY_REJECTED)
	if (!!current !== rejected) await browser.storage.local.set({ [KEY_REJECTED]: rejected })
}
export async function isBuiltInKeyRejected(): Promise<boolean> {
	const { [KEY_REJECTED]: rejected } = await browser.storage.local.get(KEY_REJECTED)
	return !!rejected
}
export function onBuiltInKeyRejectedChanged(callback: (rejected: boolean) => void) {
	browser.storage?.onChanged?.addListener((changes, area) => {
		if (area === "local" && changes[KEY_REJECTED]) callback(!!changes[KEY_REJECTED].newValue)
	})
}

// TMDb hands out two kinds of credential: a 32-character v3 "API key" (query parameter) and a long
// "API Read Access Token" (bearer header). Accept whichever the user pastes.
const V3_KEY = /^[a-f0-9]{32}$/i
export function tmdbRequest(url: string, token: string): { url: string; headers: Record<string, string> } {
	const headers: Record<string, string> = { accept: "application/json" }
	if (V3_KEY.test(token)) {
		const withKey = new URL(url)
		withKey.searchParams.set("api_key", token)
		return { url: withKey.toString(), headers }
	}
	if (token) headers.Authorization = `Bearer ${token}`
	return { url, headers }
}

export type CheckResult = "ok" | "invalid" | "offline"

export async function checkTmdbToken(token: string): Promise<CheckResult> {
	if (!token.trim()) return "invalid"
	try {
		const auth = tmdbRequest("https://api.themoviedb.org/3/configuration", token.trim())
		return await request(
			auth.url,
			(response) => (response.ok ? "ok" : response.status === 401 || response.status === 403 ? "invalid" : "offline"),
			{ headers: auth.headers },
		)
	} catch {
		return "offline"
	}
}

export const cleanUsername = (input: string) =>
	input
		.trim()
		.replace(/^@/, "")
		.replace(/^(https?:\/\/)?(www\.)?letterboxd\.com\//i, "")
		.split("/")[0]
		.toLowerCase()

export async function checkLetterboxdUsername(username: string): Promise<CheckResult> {
	const name = cleanUsername(username)
	if (!/^[a-z0-9_]{2,}$/.test(name)) return "invalid"
	try {
		// GET, not HEAD: Letterboxd's bot protection refuses bare HEAD requests
		return await request(`https://letterboxd.com/${name}/`, (response) =>
			response.ok ? "ok" : response.status === 404 ? "invalid" : "offline",
		)
	} catch {
		return "offline"
	}
}

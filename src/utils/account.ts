// The user's own Letterboxd username and TMDb key, entered during onboarding. Nothing is baked into a
// release build; a sideloaded dev build can still fall back to the values in .env.
export type Account = { letterboxdUsername: string; tmdbToken: string }

const STORAGE_KEY = "streambuddyAccount"
const BUILD_DEFAULTS: Account = { letterboxdUsername: __LETTERBOXD_USERNAME__, tmdbToken: __TMDB_TOKEN__ }

function normalize(stored: Partial<Account> | undefined): Account {
	return {
		letterboxdUsername: (stored?.letterboxdUsername ?? "").trim() || BUILD_DEFAULTS.letterboxdUsername,
		tmdbToken: (stored?.tmdbToken ?? "").trim() || BUILD_DEFAULTS.tmdbToken,
	}
}

let cached: Promise<Account> | null = null
export function getAccount(): Promise<Account> {
	cached ??= Promise.resolve()
		.then(() => browser.storage.sync.get(STORAGE_KEY))
		.then((result) => normalize(result?.[STORAGE_KEY] as Partial<Account> | undefined))
		.catch(() => normalize(undefined))
	return cached
}

export async function saveAccount(changes: Partial<Account>): Promise<Account> {
	const { [STORAGE_KEY]: stored } = await browser.storage.sync.get(STORAGE_KEY)
	const next = { ...(stored as Partial<Account> | undefined), ...changes }
	await browser.storage.sync.set({ [STORAGE_KEY]: next })
	cached = Promise.resolve(normalize(next))
	return cached
}

export function onAccountChanged(callback: (account: Account) => void) {
	browser.storage?.onChanged?.addListener((changes, area) => {
		if (area !== "sync" || !changes[STORAGE_KEY]) return
		cached = Promise.resolve(normalize(changes[STORAGE_KEY].newValue as Partial<Account> | undefined))
		cached.then(callback)
	})
}

export const isSetUp = (account: Account) => !!account.tmdbToken

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
		const request = tmdbRequest("https://api.themoviedb.org/3/configuration", token.trim())
		const response = await fetch(request.url, { headers: request.headers })
		if (response.ok) return "ok"
		return response.status === 401 || response.status === 403 ? "invalid" : "offline"
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
		const response = await fetch(`https://letterboxd.com/${name}/`)
		if (response.ok) return "ok"
		return response.status === 404 ? "invalid" : "offline"
	} catch {
		return "offline"
	}
}

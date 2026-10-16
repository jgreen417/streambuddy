// Keep the deadline active through body consumption, so a stalled response cannot hold a lookup slot.
const REQUEST_TIMEOUT_MS = 10_000
const MAX_COOLDOWN_MS = 15 * 60_000
const coolingDown = new Map<string, number>()
// The background is an MV3 service worker (non-persistent in Firefox), so it can unload mid-cooldown. Each host's
// cooldown is also kept in storage under its own key, so a restarted worker still waits out a provider's Retry-After,
// and two contexts (the options page and the background) saving different hosts at once can't overwrite each other.
const COOLDOWN_PREFIX = "networkCooldown:"
const hostsLoaded = new Map<string, Promise<void>>()
let listening = false
function adoptCooldown(host: string, until: unknown) {
	if (typeof until === "number" && until > Date.now())
		coolingDown.set(host, Math.max(coolingDown.get(host) ?? 0, until))
}
function loadCooldown(host: string) {
	let loaded = hostsLoaded.get(host)
	if (!loaded) {
		loaded = (async () => {
			try {
				if (!listening) {
					listening = true
					// another context may hit a 429 later: pick its cooldown up too
					browser.storage.onChanged.addListener((changes, area) => {
						if (area !== "local") return
						for (const [key, change] of Object.entries(changes))
							if (key.startsWith(COOLDOWN_PREFIX)) adoptCooldown(key.slice(COOLDOWN_PREFIX.length), change.newValue)
					})
				}
				const key = COOLDOWN_PREFIX + host
				adoptCooldown(host, (await browser.storage.local.get(key))?.[key])
			} catch {
				// no storage (a test, or a page without extension APIs): cooldowns just don't survive a restart
			}
		})()
		hostsLoaded.set(host, loaded)
	}
	return loaded
}
function saveCooldown(host: string) {
	const until = coolingDown.get(host)
	if (!until) return
	Promise.resolve()
		.then(() => browser.storage.local.set({ [COOLDOWN_PREFIX + host]: until }))
		.catch(() => {})
}
export class NetworkRequestError extends Error {
	override name = "NetworkRequestError"
}

export async function request<T>(
	url: string,
	consume: (response: Response) => T | Promise<T>,
	init: RequestInit = {},
): Promise<T> {
	const host = new URL(url).hostname
	await loadCooldown(host)
	if ((coolingDown.get(host) ?? 0) > Date.now()) throw new NetworkRequestError("HTTP 429 (retry later)")
	const controller = new AbortController()
	let timer: ReturnType<typeof setTimeout> | undefined
	const deadline = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			reject(new NetworkRequestError("Request timed out"))
			controller.abort()
		}, REQUEST_TIMEOUT_MS)
	})
	try {
		return await Promise.race([
			(async () => {
				const response = await fetch(url, { ...init, signal: controller.signal }).catch(() => {
					throw new NetworkRequestError("Network request failed")
				})
				if (response.status === 429) {
					const retryAfter = response.headers?.get("Retry-After")
					const seconds = retryAfter?.trim() ? Number(retryAfter) : Number.NaN
					const until =
						Number.isFinite(seconds) && seconds >= 0 ? Date.now() + seconds * 1000 : Date.parse(retryAfter ?? "")
					// a deadline that has already passed (clock skew, or Retry-After: 0) allows the next request at once;
					// only a missing or unreadable header gets the default wait
					// capped, so one odd header can't block a provider (and the setup checks) for days
					const cooldownEnds = Number.isFinite(until)
						? Math.min(until, Date.now() + MAX_COOLDOWN_MS)
						: Date.now() + 30_000
					if (cooldownEnds > Date.now()) {
						coolingDown.set(host, Math.max(coolingDown.get(host) ?? 0, cooldownEnds))
						saveCooldown(host)
					}
				}
				return consume(response)
			})(),
			deadline,
		])
	} finally {
		clearTimeout(timer)
		controller.abort()
	}
}

async function readBody<T>(read: () => Promise<T>): Promise<T> {
	try {
		return await read()
	} catch (error) {
		if (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError"))
			throw new NetworkRequestError("Network response interrupted")
		throw error
	}
}
export const readText = (response: Response) => readBody(() => response.text())
export const readJson = (response: Response) => readBody(() => response.json())

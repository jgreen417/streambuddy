// Keep the deadline active through body consumption, so a stalled response cannot hold a lookup slot.
const REQUEST_TIMEOUT_MS = 10_000
const coolingDown = new Map<string, number>()
// The background is an MV3 service worker (non-persistent in Firefox), so it can unload mid-cooldown. Cooldowns are
// kept in storage too, so a restarted worker still waits out a provider's Retry-After.
const COOLDOWN_KEY = "networkCooldowns"
let cooldownsLoaded: Promise<void> | undefined
function adoptCooldowns(stored: Record<string, number> | undefined) {
	for (const [host, until] of Object.entries(stored ?? {}))
		if (until > Date.now()) coolingDown.set(host, Math.max(coolingDown.get(host) ?? 0, until))
}
function loadCooldowns() {
	cooldownsLoaded ??= (async () => {
		try {
			const stored = (await browser.storage.local.get(COOLDOWN_KEY))?.[COOLDOWN_KEY] as
				Record<string, number> | undefined
			adoptCooldowns(stored)
			// another context (the options page, or the background) may save a cooldown later: pick it up too
			browser.storage.onChanged.addListener((changes, area) => {
				if (area === "local" && changes[COOLDOWN_KEY])
					adoptCooldowns(changes[COOLDOWN_KEY].newValue as Record<string, number>)
			})
		} catch {
			// no storage (a test, or a page without extension APIs): cooldowns just don't survive a restart
		}
	})()
	return cooldownsLoaded
}
// Merge rather than replace: the options page and the background each keep their own map, so one context's save
// must not drop a deadline the other wrote.
function saveCooldowns() {
	Promise.resolve()
		.then(async () => {
			const stored = (await browser.storage.local.get(COOLDOWN_KEY))?.[COOLDOWN_KEY] as
				Record<string, number> | undefined
			const now = Date.now()
			const merged: Record<string, number> = {}
			for (const [host, until] of [...Object.entries(stored ?? {}), ...coolingDown])
				if (until > now) merged[host] = Math.max(merged[host] ?? 0, until)
			await browser.storage.local.set({ [COOLDOWN_KEY]: merged })
		})
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
	await loadCooldowns()
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
					const cooldownEnds = Number.isFinite(until) ? until : Date.now() + 30_000
					if (cooldownEnds > Date.now()) {
						coolingDown.set(host, Math.max(coolingDown.get(host) ?? 0, cooldownEnds))
						saveCooldowns()
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

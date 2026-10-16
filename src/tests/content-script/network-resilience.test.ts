import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkLetterboxdUsername, checkTmdbToken } from "@/utils/account"
import { fetchLetterboxdRating } from "@/utils/ratings"

const realFetch = globalThis.fetch
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	globalThis.fetch = realFetch
	vi.useRealTimers()
})
function hangingFetch() {
	globalThis.fetch = vi.fn(
		(_input, init) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
			}),
	)
}
describe("network recovery", () => {
	it("returns offline from both setup checks when the network never responds", async () => {
		hangingFetch()
		let tmdb: string | undefined
		let letterboxd: string | undefined
		const checks = Promise.all([
			checkTmdbToken("example-token").then((result) => {
				tmdb = result
			}),
			checkLetterboxdUsername("exampleuser").then((result) => {
				letterboxd = result
			}),
		])
		await vi.advanceTimersByTimeAsync(10_001)
		expect(tmdb).toBe("offline")
		expect(letterboxd).toBe("offline")
		await checks
	})
	it("keeps the public score when friends never respond", async () => {
		globalThis.fetch = vi.fn(async (input, init) => {
			if (String(input).includes("/friends/"))
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
				})
			const response = new Response(
				'<script type="application/ld+json">{"aggregateRating":{"ratingValue":4,"ratingCount":10}}</script>',
			)
			Object.defineProperty(response, "url", { value: "https://letterboxd.com/film/example/" })
			return response
		})
		let score: number | undefined
		const pending = fetchLetterboxdRating(123, "exampleuser").then((result) => {
			score = result?.rating
		})
		await vi.advanceTimersByTimeAsync(10_001)
		expect(score).toBe(4)
		await pending
	})
	it("fails a stalled film response body so fallback can proceed", async () => {
		globalThis.fetch = vi.fn(async (_input, init) => {
			const stream = new ReadableStream({
				start(controller) {
					init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")))
				},
			})
			const response = new Response(stream)
			Object.defineProperty(response, "url", { value: "https://letterboxd.com/film/example/" })
			return response
		})
		let failed = false
		const pending = fetchLetterboxdRating(123).catch(() => {
			failed = true
		})
		await vi.advanceTimersByTimeAsync(10_001)
		expect(failed).toBe(true)
		await pending
	})
})

describe("provider rate limits", () => {
	it.each([
		["60", 60_000],
		["Wed, 21 Oct 2026 07:29:00 GMT", 60_000],
		[null, 30_000],
		["invalid", 30_000],
	])("honours Retry-After %s without retrying or blocking another provider", async (retryAfter, wait) => {
		vi.resetModules()
		const { request } = await import("@/utils/network")
		vi.setSystemTime(new Date("2026-10-21T07:28:00Z"))
		let letterboxdCalls = 0
		globalThis.fetch = vi.fn(async (input) => {
			if (new URL(String(input)).hostname === "letterboxd.com") {
				letterboxdCalls++
				return new Response("rate limited", {
					status: 429,
					headers: retryAfter === null ? {} : { "Retry-After": retryAfter },
				})
			}
			return new Response('{"rating":8}', { status: 200 })
		})
		expect(await request("https://letterboxd.com/film/example/", (response) => response.status)).toBe(429)
		await expect(request("https://letterboxd.com/tmdb/123/", (response) => response.status)).rejects.toThrow("429")
		expect(await request("https://caching.graphql.imdb.com/", (response) => response.json())).toEqual({ rating: 8 })
		await vi.advanceTimersByTimeAsync(wait - 1)
		await expect(request("https://letterboxd.com/another/", (response) => response.status)).rejects.toThrow("429")
		expect(letterboxdCalls).toBe(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(await request("https://letterboxd.com/another/", (response) => response.status)).toBe(429)
		expect(letterboxdCalls).toBe(2)
	})
})

describe("provider cooldowns across background restarts", () => {
	it("saves a Retry-After cooldown and honours it after a restart", async () => {
		const browser = await import("webextension-polyfill")
		let saved: Record<string, unknown> = {}
		vi.mocked(browser.storage.local.set).mockImplementation(async (items) => {
			saved = { ...saved, ...items }
		})
		vi.mocked(browser.storage.local.get).mockImplementation(async () => saved as never)
		let calls = 0
		globalThis.fetch = vi.fn(async () => {
			calls++
			return new Response("slow down", { status: 429, headers: { "Retry-After": "60" } })
		})
		vi.resetModules()
		const first = await import("@/utils/network")
		expect(await first.request("https://letterboxd.com/film/a/", (response) => response.status)).toBe(429)
		await vi.waitFor(() => expect(saved.networkCooldowns).toBeDefined())
		// a fresh module is a restarted worker: its in-memory map starts empty
		vi.resetModules()
		const restarted = await import("@/utils/network")
		await expect(restarted.request("https://letterboxd.com/film/b/", (response) => response.status)).rejects.toThrow(
			"429",
		)
		expect(calls).toBe(1)
		vi.mocked(browser.storage.local.get).mockReset()
		vi.mocked(browser.storage.local.set).mockReset()
	})
})

describe("provider cooldowns shared by several extension contexts", () => {
	it("keeps another context's cooldown when saving its own", async () => {
		const browser = await import("webextension-polyfill")
		let saved: Record<string, unknown> = {}
		vi.mocked(browser.storage.local.set).mockImplementation(async (items) => {
			saved = { ...saved, ...items }
		})
		vi.mocked(browser.storage.local.get).mockImplementation(async () => saved as never)
		const calls: string[] = []
		globalThis.fetch = vi.fn(async (input) => {
			calls.push(new URL(String(input)).hostname)
			return new Response("slow down", { status: 429, headers: { "Retry-After": "600" } })
		})
		vi.resetModules()
		const options = await import("@/utils/network")
		// the options page loads its (empty) snapshot first
		await options.request("https://example.org/", (response) => response.status).catch(() => {})
		vi.resetModules()
		const background = await import("@/utils/network")
		await background.request("https://letterboxd.com/film/a/", (response) => response.status)
		await vi.waitFor(() => expect(Object.keys((saved.networkCooldowns as object) ?? {})).toContain("letterboxd.com"))
		await options.request("https://api.themoviedb.org/3/configuration", (response) => response.status)
		await vi.waitFor(() =>
			expect(Object.keys(saved.networkCooldowns as object)).toEqual(
				expect.arrayContaining(["letterboxd.com", "api.themoviedb.org"]),
			),
		)
		vi.resetModules()
		const restarted = await import("@/utils/network")
		await expect(restarted.request("https://letterboxd.com/film/b/", (response) => response.status)).rejects.toThrow(
			"429",
		)
		expect(calls.filter((host) => host === "letterboxd.com")).toHaveLength(1)
		vi.mocked(browser.storage.local.get).mockReset()
		vi.mocked(browser.storage.local.set).mockReset()
	})
})

describe("cooldown edge cases", () => {
	it("allows the next request at once when Retry-After has already passed", async () => {
		vi.resetModules()
		const { request } = await import("@/utils/network")
		vi.setSystemTime(new Date("2026-10-21T07:28:00Z"))
		let calls = 0
		globalThis.fetch = vi.fn(async () => {
			calls++
			return new Response("slow down", { status: 429, headers: { "Retry-After": "Wed, 21 Oct 2026 07:27:00 GMT" } })
		})
		expect(await request("https://letterboxd.com/film/a/", (response) => response.status)).toBe(429)
		expect(await request("https://letterboxd.com/film/b/", (response) => response.status)).toBe(429)
		expect(calls).toBe(2)
	})
	it("picks up a cooldown another context saves after this one loaded", async () => {
		const browser = await import("webextension-polyfill")
		let listener: ((changes: Record<string, { newValue?: unknown }>, area: string) => void) | undefined
		vi.mocked(browser.storage.onChanged.addListener).mockImplementation((callback) => {
			listener = callback as never
		})
		vi.mocked(browser.storage.local.get).mockImplementation(async () => ({}) as never)
		let calls = 0
		globalThis.fetch = vi.fn(async () => {
			calls++
			return new Response("{}", { status: 200 })
		})
		vi.resetModules()
		const { request } = await import("@/utils/network")
		await request("https://api.themoviedb.org/3/configuration", (response) => response.status)
		listener?.({ networkCooldowns: { newValue: { "api.themoviedb.org": Date.now() + 60_000 } } }, "local")
		await expect(request("https://api.themoviedb.org/3/configuration", (response) => response.status)).rejects.toThrow(
			"429",
		)
		expect(calls).toBe(1)
		vi.mocked(browser.storage.local.get).mockReset()
		vi.mocked(browser.storage.onChanged.addListener).mockReset()
	})
})

describe("TMDb setup rate limit", () => {
	it("returns offline during Retry-After then validates successfully without an automatic retry", async () => {
		vi.resetModules()
		const { checkTmdbToken: check } = await import("@/utils/account")
		let calls = 0
		globalThis.fetch = vi.fn(async (input) => {
			expect(new URL(String(input)).hostname).toBe("api.themoviedb.org")
			calls++
			return calls === 1
				? new Response("slow down", { status: 429, headers: { "Retry-After": "60" } })
				: new Response("{}", { status: 200 })
		})
		expect(await check("example-token")).toBe("offline")
		expect(await check("example-token")).toBe("offline")
		await vi.advanceTimersByTimeAsync(59_999)
		expect(await check("example-token")).toBe("offline")
		expect(calls).toBe(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(calls).toBe(1)
		expect(await check("example-token")).toBe("ok")
		expect(calls).toBe(2)
	})
})

describe("unexpected callback failures", () => {
	it("preserves application TypeErrors instead of classifying them as network interruptions", async () => {
		vi.resetModules()
		const { request } = await import("@/utils/network")
		globalThis.fetch = vi.fn(async () => new Response("{}"))
		await expect(
			request("https://api.themoviedb.org/3/configuration", () => {
				throw new TypeError("application bug")
			}),
		).rejects.toThrow("application bug")
	})
})

import { test as base, chromium, expect, type BrowserContext, type Page, type Route } from "@playwright/test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { artSvg, silentWav } from "./art"
import { dbCache, PROFILE } from "./ratings"

// Runs the real, built extension (see global-setup.ts) in Chromium against saved copies of the streaming sites.
// Every request is answered here: the fixture pages, their artwork, the few site and TMDb calls streamBuddy makes,
// and anything else is refused, so a run needs no network, accounts or API keys and draws the same every time.

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const EXTENSION_DIR = path.resolve(HERE, "../.build/chrome")
const FIXTURES = path.join(HERE, "fixtures")

// what a test can change before the page opens; settings are merged over the extension's defaults
export type OpenOptions = {
	settings?: { General?: Record<string, unknown>; Video?: Record<string, unknown> }
	// signed in to Letterboxd as PROFILE (your ratings, watchlist, the credits prompt); on by default
	signedIn?: boolean
	// with signedIn, a TMDb key but no Letterboxd username linked
	noLetterboxd?: boolean
	viewport?: { width: number; height: number }
}

const PAGES: { host: RegExp; path: RegExp; file: string }[] = [
	{ host: /netflix\.com$/, path: /^\/watch\//, file: "netflix-player.html" },
	{ host: /netflix\.com$/, path: /^\//, file: "netflix.html" },
	{ host: /primevideo\.com$/, path: /^\//, file: "prime.html" },
	{ host: /max\.com$/, path: /^\//, file: "max.html" },
]

// Netflix's pathEvaluator: which series each episode card belongs to (80003 has none, so stays unrated)
const NETFLIX_SERIES: Record<string, [string, string]> = {
	"80001": ["90001", "Ripley"],
	"80002": ["90002", "Baby Reindeer"],
}
// TMDb search, for lookups that don't come from the seeded cache (the player's credits prompt)
const TMDB_RESULTS: Record<string, object> = {
	"Past Lives": {
		id: 666277,
		media_type: "movie",
		title: "Past Lives",
		vote_average: 7.8,
		vote_count: 3100,
		release_date: "2023-06-02",
	},
	Aftersun: {
		id: 965150,
		media_type: "movie",
		title: "Aftersun",
		vote_average: 7.7,
		vote_count: 2400,
		release_date: "2022-10-21",
	},
	Godland: {
		id: 900667,
		media_type: "movie",
		title: "Godland",
		vote_average: 7.1,
		vote_count: 300,
		release_date: "2022-12-02",
	},
}
// the film each player URL is playing (netflix-player.html shows this title)
export const PLAYER_FILMS: Record<string, string> = {
	"81572765": "Past Lives",
	"81572766": "Aftersun",
	"81572767": "Godland",
}
// Letterboxd pages for the player's films only (card badges come from the seeded cache): the film page with its
// average and TMDb id, /tmdb/{id}/ redirecting to it, and which of PROFILE's friends rated it
const LETTERBOXD_FILMS: Record<string, { tmdb: number; rating: number; friends: { name: string; rating: number }[] }> = {
	"past-lives": { tmdb: 666277, rating: 3.94, friends: [{ name: "sam", rating: 4.5 }, { name: "alex", rating: 4 }] },
	aftersun: {
		tmdb: 965150,
		rating: 4.12,
		friends: [
			{ name: "sam", rating: 4.5 },
			{ name: "alex", rating: 4 },
			{ name: "priya", rating: 4 },
			{ name: "jo", rating: 3.5 },
		],
	},
	godland: { tmdb: 900667, rating: 3.8, friends: [] },
}
function letterboxdPage(url: URL) {
	const tmdb = /^\/tmdb\/(\d+)\/$/.exec(url.pathname)?.[1]
	if (tmdb) {
		const slug = Object.keys(LETTERBOXD_FILMS).find((key) => LETTERBOXD_FILMS[key].tmdb === Number(tmdb))
		return slug ? { status: 302, headers: { location: `https://letterboxd.com/film/${slug}/` } } : null
	}
	const film = /^\/film\/([^/]+)\/$/.exec(url.pathname)?.[1]
	if (film && LETTERBOXD_FILMS[film]) {
		const { tmdb, rating } = LETTERBOXD_FILMS[film]
		const ld = JSON.stringify({ aggregateRating: { ratingValue: rating, ratingCount: 250000 } })
		return {
			contentType: "text/html",
			body: `<div data-tmdb-id="${tmdb}" data-tmdb-type="movie"></div><script type="application/ld+json">${ld}</script>`,
		}
	}
	const friends = /^\/[^/]+\/friends\/film\/([^/]+)\/$/.exec(url.pathname)?.[1]
	if (friends && LETTERBOXD_FILMS[friends]) {
		const rows = LETTERBOXD_FILMS[friends].friends.map(
			(friend) =>
				`<tr><td><a href="/${friend.name}/" class="name">${friend.name}</a></td>` +
				`<td class="col-rating"><span class="rating rated-${friend.rating * 2}"></span></td></tr>`,
		)
		return { contentType: "text/html", body: `<table>${rows.join("")}</table>` }
	}
	return null
}

const WAV = silentWav(22 * 60)

async function handle(route: Route) {
	const request = route.request()
	const url = new URL(request.url())
	if (url.pathname.startsWith("/art/"))
		return route.fulfill({
			contentType: "image/svg+xml",
			body: artSvg(url),
			headers: { "cache-control": "max-age=3600" },
		})
	if (url.pathname === "/media/feature.wav") return fulfillRange(route, WAV, "audio/wav")
	if (/netflix\.com$/.test(url.hostname) && url.pathname.includes("pathEvaluator")) {
		const ids: number[] = JSON.parse(new URLSearchParams(request.postData() ?? "").get("path") ?? "[]")[1] ?? []
		const videos: Record<string, object> = {}
		for (const id of ids.map(String)) {
			const series = NETFLIX_SERIES[id]
			if (!series) continue
			videos[id] = { ancestor: { $type: "ref", value: ["videos", series[0]] } }
			videos[series[0]] = { title: { $type: "atom", value: series[1] } }
		}
		return route.fulfill({ json: { jsonGraph: { videos } } })
	}
	if (url.hostname === "api.themoviedb.org" && url.pathname.startsWith("/3/search/")) {
		const result = TMDB_RESULTS[url.searchParams.get("query") ?? ""]
		return route.fulfill({ json: { page: 1, results: result ? [result] : [], total_results: result ? 1 : 0 } })
	}
	if (url.hostname === "letterboxd.com") {
		const page = letterboxdPage(url)
		if (page) return route.fulfill(page)
	}
	if (request.resourceType() === "document") {
		const page = PAGES.find((entry) => entry.host.test(url.hostname) && entry.path.test(url.pathname))
		if (page) {
			let body = await readFile(path.join(FIXTURES, page.file), "utf8")
			const film = PLAYER_FILMS[/^\/watch\/(\d+)/.exec(url.pathname)?.[1] ?? ""]
			if (film) body = body.replace("<h4>Past Lives</h4>", `<h4>${film}</h4>`)
			return route.fulfill({ contentType: "text/html", body })
		}
	}
	// the rest of Letterboxd, IMDb, fonts from the sites, analytics: nothing the fixtures need
	return route.abort("blockedbyclient")
}

// media elements seek with range requests
function fulfillRange(route: Route, body: Buffer, contentType: string) {
	const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? "")
	if (!range) return route.fulfill({ body, contentType, headers: { "accept-ranges": "bytes" } })
	const start = Number(range[1])
	const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
	return route.fulfill({
		status: 206,
		body: body.subarray(start, end + 1),
		contentType,
		headers: { "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${body.length}` },
	})
}

async function launch(options: OpenOptions) {
	const profileDir = await mkdtemp(path.join(tmpdir(), "sb-visual-"))
	const context = await chromium.launchPersistentContext(profileDir, {
		channel: "chromium",
		headless: true,
		viewport: options.viewport ?? { width: 1440, height: 900 },
		deviceScaleFactor: 1,
		reducedMotion: "reduce",
		locale: "en-US",
		timezoneId: "UTC",
		args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
	})
	// only the web; the extension's own files load as usual
	await context.route(/^https?:\/\//, handle)
	const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
	// on first install the extension clears its local storage and then opens its welcome page; seed after that,
	// or the clear can wipe the seeded ratings
	const isWelcome = (page: Page) => page.url().includes("options-page")
	if (!context.pages().some(isWelcome)) await context.waitForEvent("page", { predicate: isWelcome, timeout: 15_000 })
	await expect.poll(() => worker.evaluate(() => !!globalThis.chrome?.storage?.local)).toBe(true)
	const today = new Date().toISOString().split("T")[0]
	const signedIn = options.signedIn ?? true
	const letterboxd = signedIn && !options.noLetterboxd
	await worker.evaluate(
		async ({ local, sync }) => {
			await chrome.storage.local.set(local)
			await chrome.storage.sync.set(sync)
		},
		{
			local: {
				DBCache: dbCache(today, options.settings?.General?.ratingSources as Parameters<typeof dbCache>[1]),
				...(letterboxd ? { letterboxdProfile: { ...PROFILE, fetchedAt: Date.now() } } : {}),
			},
			sync: {
				settings: {
					...options.settings,
					General: { GCdate: today, ...options.settings?.General },
				},
				...(signedIn
					? { streambuddyAccount: { letterboxdUsername: letterboxd ? PROFILE.username : "", tmdbToken: "visual-test" } }
					: {}),
			},
		},
	)
	for (const page of context.pages()) await page.close()
	return { context, profileDir }
}

export const test = base.extend<{ open: (url: string, options?: OpenOptions) => Promise<Page> }>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their first argument
	open: async ({}, use) => {
		const opened: { context: BrowserContext; profileDir: string }[] = []
		await use(async (url, options = {}) => {
			const run = await launch(options)
			opened.push(run)
			const page = await run.context.newPage()
			await page.goto(url)
			return page
		})
		for (const { context, profileDir } of opened) {
			await context.close()
			await rm(profileDir, { recursive: true, force: true })
		}
	},
})
export { expect }

// Waits until every card marked with artwork has its badge, images have loaded and the badge font is in, so the
// screenshot shows the settled page.
export async function settle(page: Page, badges: number) {
	await expect(page.locator(".sb-card-rating")).toHaveCount(badges, { timeout: 15_000 })
	await page.evaluate(async () => {
		await document.fonts.ready
		await Promise.all(
			Array.from(document.images).map((img) =>
				img.complete ? null : new Promise((done) => (img.onload = img.onerror = done)),
			),
		)
		await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
	})
	// badges re-measure a beat after layout changes; let that finish
	await page.waitForTimeout(300)
}

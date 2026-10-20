// npm run sites:check -- [captures dir] [--live http://localhost:9333]
//
// Without --live: replays every capture and checks the copy against the live page it was taken from. streamBuddy's
// site code must make exactly the same of both (probe.json), and the two screenshots, artwork and video masked out,
// must match.
//
// With --live: the drift check. Opens each capture's URL on the live site in a signed-in Chrome, puts it in the same
// state, and compares the shape of what streamBuddy's site code finds there with what it found in the capture: which
// kinds of cards, where their badges go, which player controls it can see. Titles and counts change every day, so
// they aren't compared; a selector that stops matching is.
import { chromium, type Page } from "@playwright/test"
import { SERVICES } from "@/constants/streamingServices"
import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { bundleProbe, runProbe } from "./bundle"
import type { ProbeReport } from "./probe"
import { creditsMarkersIn, FEEDS, loadCapture, routeCapture, screenshotWithoutArt, type Capture } from "./replay"
import { putInState, type Steps } from "./steps"

const { values: args, positionals } = parseArgs({
	allowPositionals: true,
	options: { live: { type: "string" }, threshold: { type: "string", default: "0.01" } },
})
const root = path.resolve((positionals[0] ?? "e2e/.captures").replace(/^~/, process.env.HOME ?? "~"))
// a .partial folder is a capture that hasn't finished (capture.ts)
const states = (await readdir(root, { withFileTypes: true })).filter(
	(entry) => entry.isDirectory() && !entry.name.endsWith(".partial"),
)
const script = await bundleProbe()

// captures from before the wait and scroll were saved settled for capture.ts's default and didn't scroll
type Meta = Capture["meta"] &
	Omit<Steps, "wait" | "scroll"> & { wait?: number; scroll?: number | null; startUrl?: string }

// every path where two JSON values differ, as "path: before → after"
function differences(a: unknown, b: unknown, at = ""): string[] {
	if (JSON.stringify(a) === JSON.stringify(b)) return []
	if (a && b && typeof a === "object" && typeof b === "object") {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)])
		return [...keys].flatMap((key) =>
			differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}.${key}`),
		)
	}
	if (
		typeof a === "number" &&
		typeof b === "number" &&
		Math.abs(a - b) <= (SLACK.find(([path]) => path.test(at))?.[1] ?? 0)
	)
		return []
	return [`${at || "."}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`]
}
// Numbers that may differ by this much between a live page and its copy. A copy's video plays on from where it was
// saved for as long as the check takes to reach it; a badge sized from the artwork can land a pixel or two apart.
const SLACK: [RegExp, number][] = [
	[/\.player\.video\.at$/, 60],
	[/\.player\.video\.duration$/, 1],
	[/\.badge\.size\.\d$/, 2],
]

// The titles a signed-in account's rows show are what it has been watching, so a difference in one is printed as a
// short hash of each, which can be pasted anywhere
const TITLE_KEYS = new Set(["title", "showTitle", "playingTitle", "playingEpisode"])
const hashed = (title: string) => `title ${createHash("sha1").update(title).digest("hex").slice(0, 8)}`
function withoutTitles(report: ProbeReport | null): unknown {
	return JSON.parse(
		JSON.stringify(report, (key, value: unknown) => {
			if (typeof value !== "string") return value
			if (TITLE_KEYS.has(key)) return hashed(value)
			// an element found by its card's title
			return value.replace(/data-card-title="([^"]*)"/g, (_, title: string) => `data-card-title="${hashed(title)}"`)
		}),
	)
}

// what a page's structure means to streamBuddy, without the content that changes daily
function shape(report: ProbeReport) {
	const kinds = [...new Set(report.cards.map((card) => card.kind))].sort()
	const set = (values: unknown[]) => [...new Set(values.map((value) => JSON.stringify(value)))].sort()
	return {
		ratesCards: report.ratesCards,
		cards: Object.fromEntries(
			kinds.map((kind) => {
				const cards = report.cards.filter((card) => card.kind === kind)
				return [
					kind,
					{
						titled: cards.some((card) => card.title),
						untitledShare: Math.round((cards.filter((card) => !card.title).length / cards.length) * 10) / 10,
						mediaTypes: set(cards.map((card) => card.mediaType)),
						seenMarkers: set(cards.map((card) => card.seenMarker)),
						rowItems: set(cards.map((card) => card.rowItem)),
						badgeHosts: set(cards.map((card) => card.badge && [card.badge.host, card.badge.corner, card.badge.fit])),
						logoRaise: cards.some((card) => card.badge?.raise),
					},
				]
			}),
		),
		searchGrids: report.searchGrids.length > 0,
		detail:
			report.detail &&
			Object.fromEntries(
				// whether a page reads as a film or a series decides the lookup, so that one is compared as it is
				Object.entries(report.detail).map(([key, value]) => [key, key === "mediaType" ? value : value != null]),
			),
		// the season and episode read from each card pick the rating shown on it
		episodes: set(report.episodes.map((episode) => [episode.card, episode.target, episode.season, episode.episode])),
		player:
			report.player &&
			Object.fromEntries(
				Object.entries(report.player).map(([key, value]) =>
					// the first episode keeps its intro, so the number read is compared as it is
					["skip", "review", "endScreen", "episodeNumber"].includes(key)
						? [key, value]
						: // where the credits start decides when the review prompt comes, so the seconds are compared
							key === "creditsFromEnd" && typeof value === "number"
							? [key, Math.round(value)]
							: [key, value != null],
				),
			),
	}
}

function compareShots(expected: Buffer, actual: Buffer) {
	const a = PNG.sync.read(expected)
	const b = PNG.sync.read(actual)
	if (a.width !== b.width || a.height !== b.height) return { share: 1, diff: null }
	const diff = new PNG({ width: a.width, height: a.height })
	const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
	return { share: pixels / (a.width * a.height), diff: PNG.sync.write(diff) }
}

const browser = args.live ? await chromium.connectOverCDP(args.live) : await chromium.launch()
let failed = 0
for (const { name } of states) {
	const capture = await loadCapture(path.join(root, name))
	const meta = capture.meta as Meta
	const captured: ProbeReport | null = JSON.parse(await readFile(path.join(capture.dir, "probe.json"), "utf8"))
	const problems: string[] = []
	try {
		await checkState(capture, meta, captured, problems)
	} catch (error) {
		problems.push(`could not check: ${(error as Error).message.split("\n")[0]}`)
	}
	if (problems.length) failed++
	console.log(`${problems.length ? "✗" : "✓"} ${name}${problems.map((problem) => `\n    ${problem}`).join("")}`)
}
// a signed-in Chrome is left running; it's only disconnected from
if (!args.live) await browser.close()
process.exit(failed ? 1 : 0)

// a page of a service streamBuddy doesn't cover yet has no probe report; only its screenshot is compared
function probeOf(page: Page, meta: Meta, feeds: Capture["feeds"]) {
	return meta.service in SERVICES
		? runProbe(page, meta.service as ProbeReport["service"], script, creditsMarkersIn(feeds))
		: null
}

// the live site's answers to the feeds a capture saves, as the page loads
function liveFeeds(page: Page) {
	const feeds: Capture["feeds"] = {}
	const bodies: Promise<unknown>[] = []
	page.on("response", (response) => {
		const feed = Object.entries(FEEDS).find(([, pattern]) => pattern.test(response.url()))?.[0]
		if (!feed) return
		const entry = { url: response.url(), body: null as unknown }
		;(feeds[feed] ??= []).push(entry)
		// an answer that isn't JSON has no credits to read
		bodies.push(
			response
				.json()
				.then((body) => (entry.body = body))
				.catch(() => {}),
		)
	})
	return async () => {
		await Promise.all(bodies)
		return feeds
	}
}

async function checkState(capture: Capture, meta: Meta, captured: ProbeReport | null, problems: string[]) {
	if (args.live) {
		const page = await browser.contexts()[0].newPage()
		// the live site has the names --scrub took out of the saved addresses and steps
		const steps = { ...meta, ...capture.live }
		const feeds = liveFeeds(page)
		try {
			await page.setViewportSize(meta.viewport)
			// the page the steps were taken on, which a click may have left
			await page.goto(steps.startUrl ?? steps.url, { waitUntil: "load" })
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {})
			await putInState(page, { ...steps, wait: meta.wait ?? 3000, scroll: meta.scroll ?? null }, false)
			const live = await probeOf(page, meta, await feeds())
			if (captured && live) problems.push(...differences(shape(captured), shape(live)))
		} finally {
			await page.close()
		}
		return
	}
	const context = await browser.newContext({ viewport: meta.viewport })
	try {
		await routeCapture(context, capture)
		const page = await context.newPage()
		await page.goto(meta.url, { waitUntil: "load" })
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {})
		await putInState(page, { ...meta, wait: 0, scroll: null }, true)
		const copy = await probeOf(page, meta, capture.feeds)
		// A player whose <video> has no length live (Disney+, saved as null) is timed from the site's own player
		// clock, which the probe can't read; the copy's stand-in has the timeline's length, so its video isn't compared
		const video = captured?.player?.video
		if (video && !(video.duration > 0) && copy?.player) copy.player.video = video
		problems.push(...differences(withoutTitles(captured), withoutTitles(copy)))
		const shot = await screenshotWithoutArt(page)
		const { share, diff } = compareShots(await readFile(path.join(capture.dir, "shot.png")), shot)
		if (share > Number(args.threshold)) {
			problems.push(`screenshot: ${(share * 100).toFixed(2)}% of pixels differ (see replay-diff.png)`)
			await writeFile(path.join(capture.dir, "replay.png"), shot)
			if (diff) await writeFile(path.join(capture.dir, "replay-diff.png"), diff)
		}
	} finally {
		await context.close()
	}
}

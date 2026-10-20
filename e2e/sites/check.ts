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
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { bundleProbe, runProbe } from "./bundle"
import type { ProbeReport } from "./probe"
import { loadCapture, routeCapture, screenshotWithoutArt, type Capture } from "./replay"
import { putInState, type Steps } from "./steps"

const { values: args, positionals } = parseArgs({
	allowPositionals: true,
	options: { live: { type: "string" }, threshold: { type: "string", default: "0.01" } },
})
const root = path.resolve((positionals[0] ?? "e2e/.captures").replace(/^~/, process.env.HOME ?? "~"))
const states = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory())
const script = await bundleProbe()

// captures from before the wait and scroll were saved settled for capture.ts's default and didn't scroll
type Meta = Capture["meta"] & Omit<Steps, "wait" | "scroll"> & { wait?: number; scroll?: number | null }

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
		episodes: set(report.episodes.map((episode) => [episode.card, episode.target])),
		player:
			report.player &&
			Object.fromEntries(
				Object.entries(report.player).map(([key, value]) =>
					key === "skip" || key === "review" || key === "endScreen" ? [key, value] : [key, value != null],
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
function probeOf(page: Page, meta: Meta) {
	return meta.service in SERVICES ? runProbe(page, meta.service as ProbeReport["service"], script) : null
}

async function checkState(capture: Capture, meta: Meta, captured: ProbeReport | null, problems: string[]) {
	if (args.live) {
		const page = await browser.contexts()[0].newPage()
		try {
			await page.setViewportSize(meta.viewport)
			await page.goto(meta.url, { waitUntil: "load" })
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {})
			await putInState(page, { ...meta, wait: meta.wait ?? 3000, scroll: meta.scroll ?? null }, false)
			const live = await probeOf(page, meta)
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
		const copy = await probeOf(page, meta)
		// A player whose <video> has no length live (Disney+, saved as null) is timed from the site's own player
		// clock, which the probe can't read; the copy's stand-in has the timeline's length, so its video isn't compared
		const video = captured?.player?.video
		if (video && !(video.duration > 0) && copy?.player) copy.player.video = video
		problems.push(...differences(captured, copy))
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

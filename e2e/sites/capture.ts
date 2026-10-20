// Saves one live page state as a fixture.
//
//   npx tsx e2e/sites/capture.ts --state netflix-browse --service Netflix --url https://www.netflix.com/browse \
//     --cdp http://localhost:9333 --out ~/streambuddy-firefox-test/captures [--hover <selector>] [--click <selector>]...
//     [--fill <selector> --text <text>] [--seek-from-end <seconds>] [--scroll <px>] [--wait <ms>] [--front]
//     [--record] [--viewport 1440x900] [--scrub "Josh,joshuagreen"]
//
// --cdp attaches to a signed-in Chrome started with --remote-debugging-port (see README.md). Without it,
// the page is opened in Playwright's Chromium with the visual harness answering every request, which is how the
// capture → replay round trip is checked against the hand-made fixtures.
//
// Writes <out>/<state>/: page.html (the frozen page), images.json, resources.json + resources/ (fonts and other
// files the stylesheets point at), feeds.json (the site's own data streamBuddy reads), probe.json (what streamBuddy's
// site code made of the live page), shot.png (screenshot with artwork and video masked) and meta.json.
import { chromium, type Browser, type Page, type Response } from "@playwright/test"
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { SERVICES, type StreamingService } from "@/constants/streamingServices"
import { handle } from "../visual/harness"
import { bundleProbe, runProbe } from "./bundle"
import type { freeze } from "./freeze"
import { startRecording } from "./record"
import { FEEDS, screenshotWithoutArt } from "./replay"
import { putInState, type Steps } from "./steps"

const { values: args } = parseArgs({
	options: {
		state: { type: "string" },
		service: { type: "string" },
		url: { type: "string" },
		cdp: { type: "string" },
		out: { type: "string", default: "e2e/.captures" },
		hover: { type: "string" },
		click: { type: "string", multiple: true },
		fill: { type: "string" },
		text: { type: "string" },
		"seek-from-end": { type: "string" },
		scroll: { type: "string" },
		wait: { type: "string", default: "3000" },
		viewport: { type: "string", default: "1440x900" },
		scrub: { type: "string", default: "" },
		front: { type: "boolean", default: false },
		record: { type: "boolean", default: false },
	},
})
if (!args.state || !args.service || !args.url) throw new Error("--state, --service and --url are required")
const service = args.service as StreamingService
const [width, height] = args.viewport!.split("x").map(Number)
const saved = path.resolve(args.out!.replace(/^~/, process.env.HOME ?? "~"), args.state)
// written beside the saved state and swapped in only once every file is there, so a capture that stops part way
// leaves the earlier one whole
const dir = `${saved}.partial`
await rm(dir, { recursive: true, force: true })

let browser: Browser
let page: Page
if (args.cdp) {
	browser = await chromium.connectOverCDP(args.cdp)
	page = await browser.contexts()[0].newPage()
	// a browser can hold video still in a background tab, so a player state needs its tab in front
	if (args.front) await page.bringToFront()
} else {
	browser = await chromium.launch()
	const context = await browser.newContext()
	await context.route(/^https?:\/\//, handle)
	page = await context.newPage()
}
// an attached browser keeps running (its connection would hold the process open), but the tab goes even when the
// capture stops part way; a launched browser is closed
try {
	await page.setViewportSize({ width, height })
	// a cached answer can come back as a 304 with no body to save, so everything is fetched afresh
	const cdp = await page.context().newCDPSession(page)
	await cdp.send("Network.enable")
	await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })

	// recorded from the first request on: stylesheets the page can't read back itself, fonts and images the
	// stylesheets point at, and the data feeds
	const sheets: Record<string, string> = {}
	const resources: Record<string, { file: string; type: string }> = {}
	const feeds: Record<string, unknown[]> = {}
	const pending: Promise<void>[] = []
	const onResponse = (response: Response) => {
		const type = response.request().resourceType()
		const url = response.url()
		// the page and its stylesheets may still ask for the address a CDN redirected, so the answer goes under that too
		const asked = [url]
		for (let from = response.request().redirectedFrom(); from; from = from.redirectedFrom()) asked.push(from.url())
		const feed = Object.entries(FEEDS).find(([, pattern]) => pattern.test(url))?.[0]
		// SVG images are the site's own drawing (icons, backgrounds), not artwork, so they're kept like fonts
		const svg = type === "image" && (response.headers()["content-type"] ?? "").includes("svg")
		if (!feed && !svg && !["stylesheet", "font"].includes(type)) return
		pending.push(
			response
				.body()
				.then(async (body) => {
					if (feed)
						(feeds[feed] ??= []).push({
							url,
							request: response.request().postData(),
							body: JSON.parse(body.toString()),
						})
					else if (type === "stylesheet") for (const at of asked) sheets[at] = body.toString()
					else {
						const file = createHash("sha1").update(url).digest("hex").slice(0, 16) + path.extname(new URL(url).pathname)
						await mkdir(path.join(dir, "resources"), { recursive: true })
						await writeFile(path.join(dir, "resources", file), body)
						for (const at of asked) resources[at] = { file, type: response.headers()["content-type"] ?? "" }
					}
				})
				.catch(() => {}),
		)
	}
	page.on("response", onResponse)

	const finishRecording = args.record ? startRecording(page, dir) : null
	await page.goto(args.url, { waitUntil: "load" })
	// a zoomed page lays out for a different width than the copy will have
	const cssWidth = await page.evaluate(() => innerWidth)
	if (cssWidth !== width)
		throw new Error(
			`The page is ${cssWidth}px wide for a ${width}px window, so the site is zoomed in this browser. Reset its zoom ` +
				"(Cmd+0 on one of its tabs) and capture again.",
		)
	await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {})
	// a click can take the page elsewhere; the live check starts from here and takes the same steps
	const startUrl = page.url()
	const steps: Steps = {
		seekFromEnd: args["seek-from-end"] ? Number(args["seek-from-end"]) : null,
		scroll: args.scroll ? Number(args.scroll) : null,
		click: args.click ?? null,
		fill: args.fill ? { selector: args.fill, text: args.text ?? "" } : null,
		hover: args.hover ?? null,
		wait: Number(args.wait),
	}
	await putInState(page, steps, false)

	// A copy has to be the site alone. With streamBuddy running, its badges are in the screenshot and the cards it has
	// picked up are marked so its own code skips them, so neither the probe nor the screenshot would describe the site.
	// Undoing that in the copy would leave the two sides of sites:check describing different pages.
	const marked = await page
		.locator("[data-sb-build], [data-streambuddy], [data-streambuddy-hidden], .sb-episode-host")
		.count()
	if (marked)
		throw new Error(
			"streamBuddy is running in this browser and has drawn into the page. Capture from a browser started with " +
				"--disable-extensions (open-browser.sh does this) so the copy is the site alone.",
		)
	// The bundle also brings the freeze step. A service streamBuddy doesn't cover yet has no site code to run; its page
	// is saved to write that code against.
	const script = await bundleProbe()
	await page.evaluate(script)
	const probe = service in SERVICES ? await runProbe(page, service, script) : null
	// Profile names and the like, replaced as whole words in every file written, the probe's report included, so the
	// copy and the report still describe the same page. Longest first, so "Josh Green" goes before "Josh"; a space in a
	// name also matches the &nbsp; the page may serialise it as.
	const names = args
		.scrub!.split(",")
		.map((name) => name.trim())
		.filter(Boolean)
		.sort((a, b) => b.length - a.length)
	const named = names.length
		? new RegExp(
				names
					.map(
						(name) =>
							`(?<![\\p{L}\\p{N}])${name
								.split(/\s+/)
								.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
								.join("(?:\\s|&nbsp;)+")}(?![\\p{L}\\p{N}])`,
					)
					.join("|"),
				"gu",
			)
		: null
	const scrub = (text: string) => (named ? text.replace(named, "Viewer") : text)
	// the screenshot is published too, so the names are replaced on the page itself first (its text, open shadow roots
	// included)
	if (named)
		await page.evaluate(
			({ source, flags }) => {
				const pattern = new RegExp(source, flags)
				for (const roots: (Document | ShadowRoot)[] = [document]; roots.length;) {
					const root = roots.pop()!
					const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
					for (let node = texts.nextNode(); node; node = texts.nextNode())
						if (node.nodeValue) node.nodeValue = node.nodeValue.replace(pattern, "Viewer")
					for (const el of Array.from(root.querySelectorAll("*"))) {
						if (el.shadowRoot) roots.push(el.shadowRoot)
						// a name can also be drawn from a field's value or a placeholder, or read out from a label
						if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
							el.value = el.value.replace(pattern, "Viewer")
						for (const attr of ["value", "placeholder", "alt", "title", "aria-label"])
							if (el.hasAttribute(attr)) el.setAttribute(attr, el.getAttribute(attr)!.replace(pattern, "Viewer"))
					}
				}
			},
			{ source: named.source, flags: named.flags },
		)
	await mkdir(dir, { recursive: true })
	await writeFile(path.join(dir, "shot.png"), await screenshotWithoutArt(page))
	// what comes in from here would land after the files are written
	page.off("response", onResponse)
	await Promise.all(pending)
	const frozen = await page.evaluate(
		(input) => (globalThis as unknown as { sbFreeze: typeof freeze }).sbFreeze(input),
		{
			sheets,
		},
	)
	const meta = {
		state: args.state,
		service,
		url: page.url(),
		startUrl,
		capturedAt: new Date().toISOString(),
		viewport: { width, height },
		userAgent: await page.evaluate(() => navigator.userAgent),
		language: await page.evaluate(() => navigator.language),
		timeZone: await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
		...steps,
		streamBuddy: execSync("git rev-parse --short HEAD").toString().trim(),
		missingSheets: frozen.missingSheets,
	}
	await mkdir(dir, { recursive: true })
	await writeFile(path.join(dir, "page.html"), scrub(frozen.html))
	const recorded = finishRecording ? await finishRecording() : 0
	for (const [name, value] of Object.entries({ images: frozen.images, resources, feeds, probe, meta }))
		await writeFile(path.join(dir, `${name}.json`), scrub(JSON.stringify(value, null, "\t")))
	// the earlier capture is moved aside rather than deleted until the new one is in its place
	const previous = `${saved}.previous.partial`
	await rm(previous, { recursive: true, force: true })
	await rename(saved, previous).catch(() => {})
	await rename(dir, saved)
	await rm(previous, { recursive: true, force: true })
	console.log(
		`${args.state}: ${probe ? `${probe.cards.length} cards, ${probe.episodes.length} episodes${probe.player ? ", player" : ""}` : "no site code yet"}; ` +
			`${Object.keys(frozen.images).length} images, ${Object.keys(resources).length} files, ` +
			`${Object.values(feeds).flat().length} feed responses${frozen.missingSheets.length ? `, ${frozen.missingSheets.length} stylesheets missing` : ""}${recorded ? `, ${recorded} responses recorded` : ""} → ${saved}`,
	)
} finally {
	if (args.cdp) await page.close()
	else await browser.close()
}
if (args.cdp) process.exit(0)

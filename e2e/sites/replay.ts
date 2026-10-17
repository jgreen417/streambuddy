// Serves a captured page state (see capture.ts) as if it were the live site: the frozen page at its own URL, the
// fonts and files it was captured with, same-size stand-ins for its artwork, and the site's own data feeds as they
// were recorded. Anything else falls through to the visual harness's answers (ratings, TMDb, Letterboxd).
import type { BrowserContext, Page, Route } from "@playwright/test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { artSvg, silentWav } from "../visual/art"
import { fulfillRange, handle } from "../visual/harness"

// the responses streamBuddy reads from each site, as recorded during capture and answered again on replay
export const FEEDS: Record<string, RegExp> = {
	netflixShows: /netflix\.com\/nq\/website\/memberapi\/release\/pathEvaluator/,
	netflixMetadata: /netflix\.com\/nq\/website\/memberapi\/release\/metadata/,
	primePlayback: /\/GetVodPlaybackResources/,
	maxPlayback: /\/playback\/v1\/playbackInfo/,
}
// what differs between a live page and its copy by design, masked out of both screenshots
const MASK = "img, video, picture, canvas, iframe"

// A screenshot without the artwork: images and video are masked, and CSS background images (which a copy draws as
// stand-ins) are switched off while it's taken. Set through each element's own style, which no site's content
// security policy blocks, and put back afterwards.
export async function screenshotWithoutArt(page: Page) {
	await page.evaluate(() => {
		for (const el of Array.from(document.querySelectorAll<HTMLElement>("*")))
			if (getComputedStyle(el).backgroundImage.includes("url(")) {
				el.dataset.sbBackground = el.style.getPropertyValue("background-image")
				el.style.setProperty("background-image", "none", "important")
			}
	})
	const shot = await page.screenshot({ mask: [page.locator(MASK)], animations: "disabled" })
	await page.evaluate(() => {
		for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-sb-background]"))) {
			el.style.setProperty("background-image", el.dataset.sbBackground ?? "")
			if (!el.dataset.sbBackground) el.style.removeProperty("background-image")
			delete el.dataset.sbBackground
		}
	})
	return shot
}

export type Capture = {
	dir: string
	meta: { state: string; service: string; url: string; viewport: { width: number; height: number } }
	images: Record<string, [number, number]>
	resources: Record<string, { file: string; type: string }>
	feeds: Record<string, { url: string; body: unknown }[]>
}

export async function loadCapture(dir: string): Promise<Capture> {
	const json = async (name: string) => JSON.parse(await readFile(path.join(dir, `${name}.json`), "utf8"))
	return {
		dir,
		meta: await json("meta"),
		images: await json("images"),
		resources: await json("resources"),
		feeds: await json("feeds"),
	}
}

// Put back what a static copy can't hold: scroll offsets, and each video as a silent stand-in of the same length,
// at the same place, playing or paused as it was.
const RUNTIME = `<script>
for (const el of document.querySelectorAll("[data-sb-scroll]")) {
	const [left, top] = el.dataset.sbScroll.split(",").map(Number)
	if (el === document.documentElement) addEventListener("load", () => scrollTo(left, top))
	else el.scrollTo(left, top)
}
for (const video of document.querySelectorAll("video[data-sb-video]")) {
	const { duration, at, paused } = JSON.parse(video.dataset.sbVideo)
	if (!duration) continue
	video.muted = true
	video.src = "/media/stand-in.wav?seconds=" + Math.ceil(duration)
	video.addEventListener("loadedmetadata", () => {
		video.currentTime = at
		if (!paused) video.play()
	}, { once: true })
}
</script>`

const standIns = new Map<number, Buffer>()
const standIn = (seconds: number) =>
	standIns.get(seconds) ?? standIns.set(seconds, silentWav(seconds, 3000)).get(seconds)!

function stableHue(url: string) {
	let hash = 0
	for (const char of url) hash = (hash * 31 + char.charCodeAt(0)) % 360
	return hash
}

export async function routeCapture(context: BrowserContext, capture: Capture) {
	const page = (await readFile(path.join(capture.dir, "page.html"), "utf8")).replace(/<\/body>/i, `${RUNTIME}</body>`)
	const answer = async (route: Route) => {
		const request = route.request()
		const url = request.url()
		if (request.resourceType() === "document" && url.split("#")[0] === capture.meta.url.split("#")[0])
			return route.fulfill({ contentType: "text/html", body: page })
		const resource = capture.resources[url]
		if (resource)
			return route.fulfill({
				contentType: resource.type,
				body: await readFile(path.join(capture.dir, "resources", resource.file)),
			})
		const size = capture.images[url]
		if (size || request.resourceType() === "image") {
			const [w, h] = size ?? [1, 1]
			const stand = new URL(url)
			stand.search = `?w=${w}&h=${h}&hue=${stableHue(url)}`
			return route.fulfill({ contentType: "image/svg+xml", body: artSvg(stand) })
		}
		const seconds = /\/media\/stand-in\.wav\?seconds=(\d+)/.exec(url)?.[1]
		if (seconds) return fulfillRange(route, standIn(Number(seconds)), "audio/wav")
		const feed = Object.entries(FEEDS).find(([, pattern]) => pattern.test(url))?.[0]
		const recorded = feed ? capture.feeds[feed] : undefined
		if (recorded?.length) {
			// the response recorded for this exact request, else the last one of its kind
			const match = recorded.find((entry) => entry.url === url) ?? recorded[recorded.length - 1]
			return route.fulfill({ json: match.body })
		}
		return handle(route)
	}
	await context.route(/^https?:\/\//, answer)
}

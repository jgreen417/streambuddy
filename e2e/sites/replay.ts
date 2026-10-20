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
// what differs between a live page and its copy by design, left out of both screenshots
// (SVG images are the site's own drawing, saved with the copy, so they're compared)
const ART = 'img:not([src*=".svg"]), video, picture, canvas, iframe'

// A screenshot without the artwork: images and video are hidden, and CSS background images (which a copy draws as
// stand-ins) are switched off while it's taken. Hidden rather than masked, so what the site draws over them (a
// player's controls, a card's title) stays in the picture. Set through each element's own style, which no site's
// content security policy blocks, and put back afterwards.
export async function screenshotWithoutArt(page: Page) {
	await page.evaluate((art) => {
		// the page's elements and those in its open shadow roots (Disney+'s player draws its Up Next card in one); a
		// loop rather than a named helper, which tsx would compile to a call the page doesn't have
		const all: HTMLElement[] = []
		for (const roots: (Document | ShadowRoot)[] = [document]; roots.length;)
			for (const el of Array.from(roots.pop()!.querySelectorAll<HTMLElement>("*"))) {
				all.push(el)
				if (el.shadowRoot) roots.push(el.shadowRoot)
			}
		for (const el of all) {
			const hide = el.matches(art)
			if (!hide && !getComputedStyle(el).backgroundImage.includes("url(")) continue
			el.dataset.sbStyle = el.getAttribute("style") ?? ""
			if (hide) el.style.setProperty("visibility", "hidden", "important")
			else el.style.setProperty("background-image", "none", "important")
		}
	}, ART)
	const shot = await page.screenshot({ animations: "disabled" })
	await page.evaluate(() => {
		const marked: HTMLElement[] = []
		for (const roots: (Document | ShadowRoot)[] = [document]; roots.length;)
			for (const el of Array.from(roots.pop()!.querySelectorAll<HTMLElement>("*"))) {
				if (el.dataset.sbStyle !== undefined) marked.push(el)
				if (el.shadowRoot) roots.push(el.shadowRoot)
			}
		for (const el of marked) {
			if (el.dataset.sbStyle) el.setAttribute("style", el.dataset.sbStyle)
			else el.removeAttribute("style")
			delete el.dataset.sbStyle
		}
	})
	return shot
}

export type Capture = {
	dir: string
	meta: { state: string; service: string; url: string; viewport: { width: number; height: number } }
	images: Record<string, [number, number]>
	resources: Record<string, { file: string; type: string }>
	feeds: Record<string, { url: string; request?: string | null; body: unknown }[]>
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
// the marks can sit inside open shadow roots too (a web-component player's <video>)
const roots = [document]
for (let i = 0; i < roots.length; i++)
	for (const el of roots[i].querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot)
const marked = (selector) => roots.flatMap((root) => Array.from(root.querySelectorAll(selector)))
for (const el of marked("[data-sb-scroll]")) {
	const [left, top] = el.dataset.sbScroll.split(",").map(Number)
	if (el === document.documentElement) addEventListener("load", () => scrollTo(left, top))
	else el.scrollTo(left, top)
}
for (const video of marked("video[data-sb-video]")) {
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
	// A site font marked optional is dropped for the fallback when it isn't there by first paint, which a busy machine
	// decides differently each run; the copy waits for it, as a live page with the font cached does
	const page = (await readFile(path.join(capture.dir, "page.html"), "utf8"))
		.replace(/font-display:\s*optional/g, "font-display: block")
		.replace(/<\/body>/i, `${RUNTIME}</body>`)
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
			// the response recorded for this exact request (Netflix asks one URL for different titles, named in the body),
			// else the last one of its kind
			const body = request.postData()
			const match =
				recorded.find((entry) => entry.url === url && (entry.request === undefined || entry.request === body)) ??
				recorded[recorded.length - 1]
			return route.fulfill({ json: match.body })
		}
		return handle(route)
	}
	await context.route(/^https?:\/\//, answer)
}

// The interactive copy of a page: every response the live page loaded, its own scripts included, recorded during
// capture (capture.ts --record) and answered again on replay, so the site's own code runs locally. Hovering any tile,
// opening menus and the site's transitions then work as they do live, as far as the recording reaches; a request
// the recording doesn't have goes to the visual harness, which answers streamBuddy's own and refuses the rest.
//
// A recording holds whatever the site sent this account, and storage.json its cookies and site storage, so both stay
// with the raw captures on the Mac and don't go into the fixtures repo.
import type { BrowserContext, Page, Request, Response, Route } from "@playwright/test"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { Script } from "node:vm"

type Storage = {
	cookies: Awaited<ReturnType<BrowserContext["cookies"]>>
	origin: string
	local: [string, string][]
	session: [string, string][]
}
type Entry = {
	method: string
	url: string
	body: string | null
	status: number
	type: string
	file: string
	// the ones a page needs to accept the answer (CORS, caching), without cookies or framing
	headers?: Record<string, string>
	// where a redirect leads; the request it leads to has its own entry
	location?: string
}

const key = (request: Request) =>
	createHash("sha1")
		.update(`${request.method()} ${request.url()} ${request.postData() ?? ""}`)
		.digest("hex")
		.slice(0, 20)
// the same address without its query, for requests that carry a timestamp or a session counter
const withoutQuery = (url: string) => url.split("?")[0]

export function startRecording(page: Page, dir: string) {
	const entries: Entry[] = []
	// a request made more than once gets a file per answer, as a poll's answers can differ
	let answers = 0
	const pending: Promise<void>[] = []
	const onResponse = (response: Response) => {
		const request = response.request()
		// a redirect comes as the response to the request it led to; each step is recorded, so the replay follows it
		for (let to = request, from = request.redirectedFrom(); from; to = from, from = from.redirectedFrom()) {
			const [step, target] = [from, to]
			pending.push(
				step.response().then((redirect) => {
					entries.push({
						method: step.method(),
						url: step.url(),
						body: step.postData(),
						status: redirect?.status() ?? 302,
						type: "",
						file: "",
						location: target.url(),
					})
				}),
			)
		}
		// the video itself can't be replayed (DRM), and a stream that stays open would hold the recording forever
		if (request.resourceType() === "media") return
		// a redirect is recorded above, once the request it leads to is answered
		if (response.status() >= 300 && response.status() < 400 && response.headers().location) return
		// its place is taken now, so a poll's answers keep the order they came in even when a later one is read first
		const entry: Entry = {
			method: request.method(),
			url: request.url(),
			body: request.postData(),
			status: response.status(),
			type: response.headers()["content-type"] ?? "",
			file: `${key(request)}-${answers++}`,
			headers: Object.fromEntries(
				Object.entries(response.headers()).filter(([name]) => /^access-control-|^cache-control$|^vary$/.test(name)),
			),
		}
		entries.push(entry)
		pending.push(
			Promise.race([
				response.body(),
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error("still open")), 10_000)),
			])
				.then(async (body) => {
					await mkdir(path.join(dir, "recording"), { recursive: true })
					await writeFile(path.join(dir, "recording", entry.file), body)
				})
				.catch(() => {
					entries.splice(entries.indexOf(entry), 1)
				}),
		)
	}
	page.on("response", onResponse)
	return async () => {
		// what comes in from here isn't written, so it isn't listed either
		page.off("response", onResponse)
		await Promise.all(pending)
		await writeFile(path.join(dir, "recording.json"), JSON.stringify(entries, null, "\t"))
		// the site's code reads its session from these before it asks for anything, and takes a different path
		// (a signed-out one) without them
		const storage: Storage = {
			// only the cookies of the hosts this page talked to, not the rest of the browser's
			cookies: await page.context().cookies([...new Set(entries.map((entry) => new URL(entry.url).origin))]),
			origin: await page.evaluate(() => location.origin),
			local: await page.evaluate(() => Object.entries(localStorage)),
			session: await page.evaluate(() => Object.entries(sessionStorage)),
		}
		await writeFile(path.join(dir, "storage.json"), JSON.stringify(storage, null, "\t"))
		return entries.length
	}
}

export async function routeRecording(context: BrowserContext, dir: string, fallback: (route: Route) => unknown) {
	const entries: Entry[] = JSON.parse(await readFile(path.join(dir, "recording.json"), "utf8"))
	const storage: Storage = JSON.parse(await readFile(path.join(dir, "storage.json"), "utf8"))
	// a cookie that has expired since is still the session the recording was made in, so it's kept for the browsing
	// session instead of being dropped
	await context.addCookies(storage.cookies.map((cookie) => ({ ...cookie, expires: -1 })))
	await context.addInitScript((storage) => {
		if (location.origin !== storage.origin) return
		for (const [key, value] of storage.local) localStorage.setItem(key, value)
		for (const [key, value] of storage.session) sessionStorage.setItem(key, value)
	}, storage)
	// a request made more than once (a poll) gets its recorded answers in order, then keeps the last; one whose query
	// changes each time (a timestamp) is matched without it, in order too. An answer given by any of the three lookups
	// is used up for the others as well.
	const used = new Set<Entry>()
	const queues = (key: (entry: Entry) => string) => {
		const map = new Map<string, Entry[]>()
		for (const entry of entries) map.set(key(entry), [...(map.get(key(entry)) ?? []), entry])
		return (wanted: string) => {
			const answers = map.get(wanted)
			const next = answers?.find((entry) => !used.has(entry))
			if (next) used.add(next)
			return next ?? answers?.at(-1)
		}
	}
	const exact = queues((entry) => `${entry.method} ${entry.url} ${entry.body ?? ""}`)
	const sameUrl = queues((entry) => `${entry.method} ${entry.url}`)
	const sameQueryless = queues((entry) => `${entry.method} ${withoutQuery(entry.url)}`)
	const find = (method: string, url: string, body: string | null) =>
		exact(`${method} ${url} ${body ?? ""}`) ??
		sameUrl(`${method} ${url}`) ??
		sameQueryless(`${method} ${withoutQuery(url)}`)
	const answer = async (route: Route) => {
		const request = route.request()
		let entry = find(request.method(), request.url(), request.postData())
		// A routed request's redirect isn't routed again, so a redirect is answered with where it ends up. A page is sent
		// on there itself, so it loads at its own address; a stylesheet's relative links are made absolute from it.
		let url = request.url()
		let [method, sent] = [request.method(), request.postData()]
		for (let steps = 0; entry?.location && steps < 10; steps++) {
			// 307 and 308 send the request on as it was; 303, and 301 or 302 after a POST, send it on as a GET
			if (entry.status === 303 || (entry.status < 303 && method === "POST")) [method, sent] = ["GET", null]
			entry = find(method, (url = entry.location), sent)
		}
		if (!entry || entry.location) return fallback(route)
		// (a page sent on as a POST, by a 307 or 308, is answered in place: location.replace can only GET)
		if (url !== request.url() && request.isNavigationRequest() && method === "GET")
			return route.fulfill({
				contentType: "text/html",
				body: `<script>location.replace(${JSON.stringify(url)})</script>`,
			})
		const body = await readFile(path.join(dir, "recording", entry.file))
		const head = { status: entry.status, contentType: entry.type, headers: entry.headers }
		if (url !== request.url() && request.resourceType() === "stylesheet")
			return route.fulfill({ ...head, body: absoluteLinks(body.toString(), url) })
		// a module is answered with one that re-exports it from where it ends up, so it loads there and its own imports
		// (and import.meta.url) resolve from that address.
		const text = body.toString()
		if (url !== request.url() && request.resourceType() === "script" && isModule(text))
			return route.fulfill({ ...head, body: reexport(url, text) })
		return route.fulfill({ ...head, body })
	}
	await context.route(/^https?:\/\//, answer)
}

// Import and export statements, import.meta and a top-level await only parse in a module, so a script that doesn't
// compile as a classic one is one. Compiling doesn't run it.
function isModule(source: string) {
	try {
		new Script(source)
		return false
	} catch {
		return true
	}
}

function absoluteLinks(css: string, base: string) {
	return css
		.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, url: string) =>
			url.startsWith("data:") ? whole : `url("${new URL(url, base).href}")`,
		)
		.replace(/@import\s+(['"])([^'"]+)\1/g, (_, quote, url: string) => `@import "${new URL(url, base).href}"`)
}

function reexport(url: string, source: string) {
	const from = JSON.stringify(url)
	// re-exporting a default the module doesn't have is a syntax error. A default is declared directly, or named in an
	// export list (`export { x as default }`, `export { default } from "./impl.js"`).
	const lists = [...source.matchAll(/\bexport\s*\{([^}]*)\}/g)].flatMap((list) => list[1].split(","))
	const exportsDefault =
		/\bexport\s+default\b/.test(source) || lists.some((item) => item.trim().split(/\s+/).at(-1) === "default")
	return `export * from ${from}\n${exportsDefault ? `export { default } from ${from}\n` : ""}`
}

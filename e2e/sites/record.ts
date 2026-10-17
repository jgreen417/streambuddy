// The interactive copy of a page: every response the live page loaded, its own scripts included, recorded during
// capture (capture.ts --record) and answered again on replay, so the site's own code runs locally. Hovering any tile,
// opening menus and the site's transitions then work as they do live, as far as the recording reaches; a request
// the recording doesn't have gets an empty 404.
//
// A recording holds whatever the site sent this account, tokens included, so it stays with the raw captures on the
// Mac and doesn't go into the fixtures repo.
import type { BrowserContext, Page, Request, Route } from "@playwright/test"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

type Entry = { method: string; url: string; body: string | null; status: number; type: string; file: string }

const key = (request: Request) =>
	createHash("sha1")
		.update(`${request.method()} ${request.url()} ${request.postData() ?? ""}`)
		.digest("hex")
		.slice(0, 20)
// the same address without its query, for requests that carry a timestamp or a session counter
const withoutQuery = (url: string) => url.split("?")[0]

export function startRecording(page: Page, dir: string) {
	const entries: Entry[] = []
	const pending: Promise<void>[] = []
	page.on("response", (response) => {
		const request = response.request()
		// a redirect has no body of its own; the request it leads to is recorded instead
		if (response.status() >= 300 && response.status() < 400) return
		pending.push(
			response
				.body()
				.then(async (body) => {
					const file = key(request)
					await mkdir(path.join(dir, "recording"), { recursive: true })
					await writeFile(path.join(dir, "recording", file), body)
					entries.push({
						method: request.method(),
						url: request.url(),
						body: request.postData(),
						status: response.status(),
						type: response.headers()["content-type"] ?? "",
						file,
					})
				})
				.catch(() => {}),
		)
	})
	return async () => {
		await Promise.all(pending)
		await writeFile(path.join(dir, "recording.json"), JSON.stringify(entries, null, "\t"))
		return entries.length
	}
}

export async function routeRecording(context: BrowserContext, dir: string, fallback: (route: Route) => unknown) {
	const entries: Entry[] = JSON.parse(await readFile(path.join(dir, "recording.json"), "utf8"))
	const exact = new Map(entries.map((entry) => [`${entry.method} ${entry.url} ${entry.body ?? ""}`, entry]))
	const answer = async (route: Route) => {
		const request = route.request()
		const entry =
			exact.get(`${request.method()} ${request.url()} ${request.postData() ?? ""}`) ??
			entries.find((entry) => entry.method === request.method() && entry.url === request.url()) ??
			entries.find(
				(entry) => entry.method === request.method() && withoutQuery(entry.url) === withoutQuery(request.url()),
			)
		if (!entry) return fallback(route)
		return route.fulfill({
			status: entry.status,
			contentType: entry.type,
			body: await readFile(path.join(dir, "recording", entry.file)),
		})
	}
	await context.route(/^https?:\/\//, answer)
}

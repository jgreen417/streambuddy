// Runs in the streaming site's own page (injected by ../credits-marker.ts), the only place the player's responses can be read. When the
// player loads a title, this picks out where the service says the end credits start and posts it to streamBuddy's
// content script: how many seconds of credits run up to the end of the title, and the title's length. It keeps what
// it has found and posts it all again when asked, for a content script that started listening after the player loaded.
import {
	CREDITS_MESSAGE,
	CREDITS_REQUEST,
	maxCreditsMarker,
	primeCreditsMarker,
	type CreditsMarker,
} from "@/utils/credits-markers"

const READERS: [RegExp, (json: never) => CreditsMarker | undefined][] = [
	[/\/playback\/v1\/playbackInfo/, maxCreditsMarker],
	[/\/GetVodPlaybackResources/, primeCreditsMarker],
]
const found: CreditsMarker[] = []
const post = (marker: CreditsMarker) => window.postMessage({ type: CREDITS_MESSAGE, ...marker }, location.origin)

function read(url: string, body: () => Promise<unknown>) {
	const reader = READERS.find(([path]) => path.test(url))?.[1]
	if (!reader) return
	body()
		.then((json) => {
			const marker = json ? reader(json as never) : undefined
			if (!marker) return
			found.push(marker)
			post(marker)
		})
		.catch(() => {})
}

// injected at most once per page, however many content scripts ask
const hooked = Symbol.for(CREDITS_MESSAGE)
if (!(hooked in window)) {
	Object.defineProperty(window, hooked, { value: true })
	const pageFetch = window.fetch
	window.fetch = async function (...args: Parameters<typeof fetch>) {
		const response = await pageFetch.apply(this, args)
		read(response.url, () => response.clone().json())
		return response
	}
	const pageOpen = XMLHttpRequest.prototype.open
	const listening = new WeakSet<XMLHttpRequest>()
	XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest["open"]>) {
		if (!listening.has(this)) {
			listening.add(this)
			this.addEventListener("load", () =>
				read(this.responseURL, async () =>
					typeof this.response === "string" ? JSON.parse(this.response) : this.response,
				),
			)
		}
		return pageOpen.apply(this, args)
	} as XMLHttpRequest["open"]
	window.addEventListener("message", (event) => {
		if (event.source === window && event.data?.type === CREDITS_REQUEST) found.forEach(post)
	})
}

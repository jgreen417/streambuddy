// Runs in the streaming site's own page (injected by ../credits-marker.ts), the only place the player's responses can be read. When the
// player loads a title, this picks out where the service says the end credits start and posts one number to
// streamBuddy's content script: how many seconds of credits run up to the end of the title. Nothing else is kept.
import { CREDITS_MESSAGE, maxCreditsMarker, primeCreditsMarker, type CreditsMarker } from "@/utils/credits-markers"

const READERS: [RegExp, (json: never) => CreditsMarker | undefined][] = [
	[/\/playback\/v1\/playbackInfo/, maxCreditsMarker],
	[/\/GetVodPlaybackResources/, primeCreditsMarker],
]

function read(url: string, body: () => Promise<unknown>) {
	const reader = READERS.find(([path]) => path.test(url))?.[1]
	if (!reader) return
	body()
		.then((json) => {
			const found = json && reader(json as never)
			if (found) window.postMessage({ type: CREDITS_MESSAGE, ...found }, location.origin)
		})
		.catch(() => {})
}

const pageFetch = window.fetch
window.fetch = async function (...args: Parameters<typeof fetch>) {
	const response = await pageFetch.apply(this, args)
	read(response.url, () => response.clone().json())
	return response
}
const pageOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest["open"]>) {
	this.addEventListener("load", () => read(this.responseURL, async () => JSON.parse(this.responseText)))
	return pageOpen.apply(this, args)
} as XMLHttpRequest["open"]

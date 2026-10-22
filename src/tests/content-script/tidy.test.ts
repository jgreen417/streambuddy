import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { quietPreviews, tidyNetflix } from "../../content-script/tidy"

describe("Netflix's games", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})
	it("hides a row of games on the home page", () => {
		document.body.innerHTML = `<section id="row"><a data-uia="cloud-game-card"></a></section>`
		tidyNetflix(true)
		expect(document.getElementById("row")!.style.display).toBe("none")
	})
	it("hides only the game in search results, not the results around it", () => {
		// search for "the", Oct 2026: one cloud game among 47 results in a single gallery grid
		document.body.innerHTML = `<div data-uia="search-page"><section data-uia="gallery"><div>
			<div id="film"><div><a data-uia="standard-card"></a></div></div>
			<div id="game"><div><a data-uia="cloud-game-card"></a></div></div>
		</div></section></div>`
		tidyNetflix(true)
		expect(document.querySelector<HTMLElement>('[data-uia="gallery"]')!.style.display).toBe("")
		expect(document.getElementById("film")!.style.display).toBe("")
		expect(document.getElementById("game")!.style.display).toBe("none")
	})
	it("hides only the game card when the search grid isn't laid out as expected", () => {
		document.body.innerHTML = `<div data-uia="search-page"><section id="results">
			<a id="film" data-uia="standard-card"></a>
			<a id="game" data-uia="cloud-game-card"></a>
		</section></div>`
		tidyNetflix(true)
		tidyNetflix(true)
		expect(document.getElementById("results")!.style.display).toBe("")
		expect(document.getElementById("film")!.style.display).toBe("")
		expect(document.getElementById("game")!.style.display).toBe("none")
	})
	it("brings back a search cell Netflix reuses for a title that isn't a game", () => {
		document.body.innerHTML = `<div data-uia="search-page"><section data-uia="gallery"><div>
			<div id="cell"><div><a data-uia="cloud-game-card"></a></div></div>
		</div></section></div>`
		tidyNetflix(true)
		document.querySelector("#cell > div")!.innerHTML = `<a data-uia="standard-card"></a>`
		tidyNetflix(true)
		expect(document.getElementById("cell")!.style.display).toBe("")
	})
})

describe("Netflix's Top 10 row", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})
	it("hides and restores the row holding ranked cards", () => {
		document.body.innerHTML = `<section id="row"><a data-uia="ranked-card"></a></section>`
		tidyNetflix(false, true)
		expect(document.getElementById("row")!.style.display).toBe("none")
		tidyNetflix(false, false)
		expect(document.getElementById("row")!.style.display).toBe("")
	})
	it("brings a row back when Netflix reuses it for something else", () => {
		document.body.innerHTML = `<section id="row"><a data-uia="ranked-card"></a></section>`
		tidyNetflix(false, true)
		document.getElementById("row")!.innerHTML = `<a data-uia="standard-card"></a>`
		tidyNetflix(false, true)
		expect(document.getElementById("row")!.style.display).toBe("")
	})
	it("still restores games when only the Top 10 row is asked for", () => {
		document.body.innerHTML = `<section id="games"><a data-uia="cloud-game-card"></a></section>`
		tidyNetflix(true, false)
		expect(document.getElementById("games")!.style.display).toBe("none")
		tidyNetflix(false, false)
		expect(document.getElementById("games")!.style.display).toBe("")
	})
})

describe("quiet previews", () => {
	beforeAll(() => {
		vi.useFakeTimers()
	})
	afterAll(() => {
		vi.useRealTimers()
	})
	afterEach(() => {
		document.body.innerHTML = ""
		quietPreviews(false)
	})
	it("mutes a preview and only unmutes what it muted", () => {
		document.body.innerHTML = `<video id="preview"></video><video id="already-muted"></video>`
		const preview = document.getElementById("preview") as HTMLVideoElement
		const alreadyMuted = document.getElementById("already-muted") as HTMLVideoElement
		alreadyMuted.muted = true
		quietPreviews(true)
		expect(preview.muted).toBe(true)
		expect(alreadyMuted.muted).toBe(true)
		quietPreviews(false)
		expect(preview.muted).toBe(false)
		expect(alreadyMuted.muted).toBe(true)
	})
	function unmute(video: HTMLVideoElement, byViewer: boolean) {
		vi.advanceTimersByTime(5000)
		if (byViewer) document.dispatchEvent(new Event("pointerdown"))
		video.muted = false
		video.dispatchEvent(new Event("volumechange"))
	}
	it("doesn't mute a preview again after the viewer unmutes it", () => {
		document.body.innerHTML = `<video id="preview"></video>`
		const preview = document.getElementById("preview") as HTMLVideoElement
		quietPreviews(true)
		unmute(preview, true)
		quietPreviews(true)
		expect(preview.muted).toBe(false)
	})
	it("mutes a preview again when the service unmutes it", () => {
		document.body.innerHTML = `<video id="preview"></video>`
		const preview = document.getElementById("preview") as HTMLVideoElement
		quietPreviews(true)
		unmute(preview, false)
		expect(preview.muted).toBe(true)
	})
	it("leaves a preview the viewer unmuted alone when switched off", () => {
		document.body.innerHTML = `<video id="preview"></video>`
		const preview = document.getElementById("preview") as HTMLVideoElement
		quietPreviews(true)
		unmute(preview, true)
		quietPreviews(false)
		expect(preview.muted).toBe(false)
	})
})

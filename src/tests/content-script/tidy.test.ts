import { afterEach, describe, expect, it } from "vitest"
import { tidyNetflix } from "../../playback/tidy"

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

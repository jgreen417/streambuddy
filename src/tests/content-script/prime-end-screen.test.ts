import { afterEach, describe, expect, it } from "vitest"
import { primeSite } from "../../content-script/sites/prime"

const video = { duration: 7014, currentTime: 6420 } as HTMLVideoElement

describe("Prime's end screen", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})
	it("ignores the hidden next-up cards the player keeps in the page", () => {
		// Scream 7: the player had zero-height next-up wrappers 30 s before the credits
		document.body.innerHTML = `<div class="atvwebplayersdk-nextupcard-wrapper"></div>`
		expect(primeSite.endScreenShowing(video)).toBe(false)
	})
	it("counts the next-up row once it's on screen", () => {
		document.body.innerHTML = `<div class="atvwebplayersdk-nextupcard-wrapper"></div>`
		const card = document.querySelector("div")!
		card.getBoundingClientRect = () => ({ height: 120 }) as DOMRect
		expect(primeSite.endScreenShowing(video)).toBe(true)
	})
	it("puts the review pill under the player's top buttons, lined up with the last one", () => {
		document.body.innerHTML = `<div id="dv-web-player"><button></button><button></button></div><div class="sb-review"></div>`
		const [subtitles, settings] = Array.from(document.querySelectorAll("button"))
		subtitles.getBoundingClientRect = () => ({ width: 38, right: 943, bottom: 56 }) as DOMRect
		settings.getBoundingClientRect = () => ({ width: 38, right: innerWidth - 24, bottom: 56 }) as DOMRect
		const review = document.querySelector<HTMLElement>(".sb-review")!
		primeSite.placeReview(review)
		expect(review.style.getPropertyValue("--sb-review-right")).toBe("24px")
		expect(review.style.getPropertyValue("--sb-review-top")).toBe("68px")
		// once the controls hide, the pill stays put
		document.getElementById("dv-web-player")!.remove()
		primeSite.placeReview(review)
		expect(review.style.getPropertyValue("--sb-review-top")).toBe("68px")
	})
})

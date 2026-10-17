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
	it("puts the review pill under the player's top-right buttons, lined up with the last one", () => {
		// Prime's top bar at a 1005px window: the X top left, subtitles and settings top right, and an open menu's item
		Object.defineProperty(document.documentElement, "clientWidth", { value: 1005, configurable: true })
		document.body.innerHTML = `<div id="dv-web-player"><button></button><button></button><button></button><button></button></div><div class="sb-review"></div>`
		const rects = [
			{ left: 24, right: 62, top: 18, bottom: 56 },
			{ left: 905, right: 943, top: 18, bottom: 56 },
			{ left: 943, right: 981, top: 18, bottom: 56 },
			{ left: 700, right: 990, top: 60, bottom: 100 },
		]
		Array.from(document.querySelectorAll("button")).forEach((button, i) => {
			button.getBoundingClientRect = () => ({ width: rects[i].right - rects[i].left, ...rects[i] }) as DOMRect
		})
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

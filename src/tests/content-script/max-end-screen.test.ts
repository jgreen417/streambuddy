import { afterEach, describe, expect, it } from "vitest"
import { maxSite } from "../../content-script/sites/max"

describe("Max's end screen", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})
	it("lines the review pill up with the bottom of the Watch Now row", () => {
		// The Batman at 1400x815: "Watch Now" is 207x52 at left 60, bottom 744
		Object.defineProperty(window, "innerHeight", { value: 815, configurable: true })
		document.body.innerHTML = `<button data-testid="play_button"></button><div class="sb-review"></div>`
		const watch = document.querySelector("button")!
		watch.getBoundingClientRect = () => ({ left: 60, top: 692, bottom: 744, width: 207, height: 52 }) as DOMRect
		const review = document.querySelector<HTMLElement>(".sb-review")!
		maxSite.placeReview(review)
		expect(review.style.getPropertyValue("--sb-review-bottom")).toBe("71px")
		expect(review.style.getPropertyValue("--sb-review-right")).toBe("60px")
		// back to the default spot once the end screen closes
		watch.remove()
		maxSite.placeReview(review)
		expect(review.style.getPropertyValue("--sb-review-bottom")).toBe("")
	})
})

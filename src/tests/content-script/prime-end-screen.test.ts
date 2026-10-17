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
})

import { test, expect, settle } from "./harness"
import { measure, specProblems } from "./geometry"
import { SITES, site } from "./sites"

// Every card type on every service: the badge is drawn on each, sits to spec (geometry.ts), and looks the same
// as the approved screenshot.
for (const { name, url, badges, shots } of SITES) {
	test(`${name} cards`, async ({ open }) => {
		const page = await open(url)
		await settle(page, badges)
		expect.soft(specProblems(await measure(page)), "badge placement").toEqual([])
		for (const shot of shots)
			await expect.soft(page.locator(`[data-shot="${shot}"]`)).toHaveScreenshot(`${name}-${shot}.png`)
	})
}

// The badge's settings change how it's drawn, not where: each look is checked for placement and screenshotted.
const LOOKS: { name: string; settings: Record<string, unknown>; video?: Record<string, unknown> }[] = [
	{ name: "glass-clear", settings: { badgeStyle: "glass", glassFrost: 0 } },
	{ name: "glass-frosted", settings: { badgeStyle: "glass", glassFrost: 100 } },
	{ name: "friends-dots", settings: { friendsStyle: "dots" } },
	{ name: "friends-trio", settings: { friendsStyle: "trio" } },
	{ name: "friends-hidden", settings: { friendsRatings: false } },
	{ name: "imdb-only", settings: { ratingSources: "imdb" } },
	{ name: "dim-low", settings: { dimBelowBand: 3 }, video: { dimLowRatings: true } },
]
for (const look of LOOKS) {
	test(`badge look: ${look.name}`, async ({ open }) => {
		const netflix = site("netflix")
		const page = await open(netflix.url, { settings: { General: look.settings, Video: look.video } })
		await settle(page, netflix.badges)
		expect.soft(specProblems(await measure(page)), "badge placement").toEqual([])
		await expect.soft(page.locator('[data-shot="standard"]')).toHaveScreenshot(`look-${look.name}.png`)
	})
}

test("signed out: no friends or personal labels", async ({ open }) => {
	const prime = site("prime")
	const page = await open(prime.url, { signedIn: false })
	await settle(page, prime.badges)
	expect.soft(specProblems(await measure(page)), "badge placement").toEqual([])
	await expect.soft(page.locator('[data-shot="carousel"]')).toHaveScreenshot("signed-out-prime-carousel.png")
})

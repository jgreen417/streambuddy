import { test, expect } from "./harness"

// What streamBuddy shows over the player when a film's credits roll.
test("end-of-film rating prompt", async ({ open }) => {
	const page = await open("https://www.netflix.com/watch/81572765")
	await expect(page.locator("body[data-seeked]")).toBeAttached({ timeout: 10_000 })
	const prompt = page.locator(".sb-rate-prompt")
	await expect(prompt).toBeVisible({ timeout: 15_000 })
	await expect(prompt).toContainText("Rate Past Lives on Letterboxd?")
	await expect(prompt.getByRole("link", { name: "Rate it" })).toHaveAttribute(
		"href",
		"https://letterboxd.com/tmdb/666277/",
	)
	await page.evaluate(() => document.fonts.ready)
	await expect.soft(page).toHaveScreenshot("credits-prompt.png")
	// it never covers the player's controls: the bottom 90px stay clear
	const box = (await prompt.boundingBox())!
	expect(box.y + box.height).toBeLessThanOrEqual(900 - 90)
})

test("no prompt when not signed in to Letterboxd", async ({ open }) => {
	const page = await open("https://www.netflix.com/watch/81572765", { signedIn: false })
	await expect(page.locator("body[data-seeked]")).toBeAttached({ timeout: 10_000 })
	await page.waitForTimeout(2500)
	await expect(page.locator(".sb-rate-prompt")).toHaveCount(0)
})

// The after-credits pill from the "Streaming buddy" prototypes (design/bet-prototypes/after-credits-pill.png and
// pill-states.png) isn't built yet. When it is, give each state a test here like the prompt's above, on the same
// player fixture: collapsed, expanded (hover/click), nobody you follow rated it, already logged ("Log again?"),
// and not signed in to Letterboxd ("Connect").
for (const state of ["collapsed", "expanded", "nobody rated", "already logged", "not connected"])
	test.fixme(`after-credits pill: ${state}`, () => {})

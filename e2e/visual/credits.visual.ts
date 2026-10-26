import type { Page } from "@playwright/test"
import { test, expect } from "./harness"

// What streamBuddy shows over the player when a film's credits roll: a collapsed "Review" pill that expands into a
// card with what your friends thought (design/bet-prototypes/after-credits-pill.png and pill-states.png).
// Player URLs pick the film (harness.ts PLAYER_FILMS): Aftersun has friends' ratings, Godland has none, and
// Past Lives is already in PROFILE's diary.
const AFTERSUN = "https://www.netflix.com/watch/81572766"
const GODLAND = "https://www.netflix.com/watch/81572767"
const PAST_LIVES = "https://www.netflix.com/watch/81572765"

async function review(page: Page) {
	await expect(page.locator("body[data-seeked]")).toBeAttached({ timeout: 10_000 })
	const root = page.locator(".sb-review")
	await expect(root).toBeVisible({ timeout: 15_000 })
	await page.evaluate(() => document.fonts.ready)
	return root
}
// it never covers the player's controls: the bottom 90px stay clear
async function clearOfControls(page: Page) {
	const box = (await page.locator(".sb-review").boundingBox())!
	expect(box.y + box.height).toBeLessThanOrEqual(900 - 90)
}

test("after-credits pill: collapsed", async ({ open }) => {
	const page = await open(AFTERSUN)
	const root = await review(page)
	await expect(root.locator(".sb-review-pill")).toContainText("Review Aftersun")
	await expect(root.locator(".sb-review-pill")).toContainText("4 friends rated it")
	await expect(root.locator(".sb-review-card")).toBeHidden()
	await expect.soft(page).toHaveScreenshot("credits-pill.png")
	await clearOfControls(page)
	// bottom left, lined up with Netflix's back arrow, clear of its next-title preview bottom right
	const back = (await page.locator('[data-uia="control-nav-back"]').boundingBox())!
	expect((await root.boundingBox())!.x).toBe(back.x)
})

test("after-credits pill: expanded", async ({ open }) => {
	const page = await open(AFTERSUN)
	const root = await review(page)
	await root.getByRole("button", { name: "Show details" }).click()
	const card = root.locator(".sb-review-card")
	await expect(card).toBeVisible()
	await expect(card).toContainText("You just finished Aftersun")
	await expect(card.locator(".sb-review-friend")).toHaveCount(3)
	await expect(card.getByRole("link", { name: "Rate on Letterboxd" })).toHaveAttribute(
		"href",
		"https://letterboxd.com/film/aftersun/",
	)
	await expect(card.getByRole("link", { name: /see all/ })).toHaveAttribute(
		"href",
		"https://letterboxd.com/buddy/friends/film/aftersun/",
	)
	await expect.soft(page).toHaveScreenshot("credits-card.png")
	await clearOfControls(page)
})

test("after-credits pill: nobody rated", async ({ open }) => {
	const page = await open(GODLAND)
	const root = await review(page)
	await expect(root.locator(".sb-review-pill")).toContainText("Be the first of your friends")
	await expect.soft(page).toHaveScreenshot("credits-pill-nobody.png")
})

test("after-credits pill: already logged", async ({ open }) => {
	const page = await open(PAST_LIVES)
	const root = await review(page)
	await expect(root.locator(".sb-review-pill")).toContainText("You rated it")
	await expect(root.getByRole("link", { name: "Log again", exact: true })).toHaveAttribute(
		"href",
		"https://letterboxd.com/film/past-lives/",
	)
	await expect.soft(page).toHaveScreenshot("credits-pill-logged.png")
})

test("after-credits pill: not connected", async ({ open }) => {
	const page = await open(PAST_LIVES, { noLetterboxd: true })
	const root = await review(page)
	await expect(root.locator(".sb-review-pill")).toContainText("No Letterboxd linked")
	await expect.soft(page).toHaveScreenshot("credits-pill-unlinked.png")
	// Connect opens settings at the Letterboxd step
	const settings = page.context().waitForEvent("page", { predicate: (p) => p.url().includes("options-page/Account") })
	await root.getByRole("button", { name: "Connect", exact: true }).click()
	await settings
	await expect(page.locator(".sb-review")).toHaveCount(0)
})

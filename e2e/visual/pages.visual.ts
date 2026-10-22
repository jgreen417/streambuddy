import type { Page } from "@playwright/test"
import { test, expect, extensionId, loaded, settle, type OpenOptions } from "./harness"
import { PROFILE } from "./ratings"
import { site } from "./sites"

// The extension's own pages (the toolbar popup and the settings pages) and the episode chips on a series' page,
// screenshotted so a change to their layout shows up in review like the badges do.

// the popup's Stats tab counts back from today, so the pages are drawn at a fixed date
const NOW = new Date("2026-10-14T20:00:00Z")
const day = (ago: number) => new Date(NOW.getTime() - ago * 86_400_000).toISOString().split("T")[0]
function seen(title: string, source: string, rating: number, platform: string, media_type: string) {
	const url =
		source === "letterboxd"
			? `https://letterboxd.com/film/${title.toLowerCase().replaceAll(" ", "-")}/`
			: "https://www.imdb.com/title/tt0000001/"
	return { title, source, rating, url, platform, media_type, seen: day(1) }
}
const WATCHED: [number, Record<string, number>][] = [
	[0, { netflix: 5400 }],
	[1, { netflix: 2700, amazon: 3000 }],
	[2, { hbo: 4200 }],
	[4, { netflix: 1800 }],
	[5, { amazon: 6600, hbo: 1500 }],
	[6, { netflix: 3300 }],
	[9, { netflix: 7200 }],
]
const LOCAL = {
	// "Synced just now", measured against the fixed date
	letterboxdProfile: { ...PROFILE, fetchedAt: NOW.getTime() },
	watchLog: Object.fromEntries(WATCHED.map(([ago, services]) => [day(ago), services])),
	savedLog: { [day(1)]: { intro: 340, recap: 95 }, [day(3)]: { ad: 180 } },
	seenTop: {
		Oppenheimer: seen("Oppenheimer", "letterboxd", 4.2, "hbo", "movie"),
		"The Holdovers": seen("The Holdovers", "letterboxd", 4.07, "amazon", "movie"),
		Succession: seen("Succession", "imdb", 8.8, "hbo", "tv"),
		"Stranger Things": seen("Stranger Things", "imdb", 8.7, "netflix", "tv"),
	},
	watchlistSeen: { "The Holdovers": seen("The Holdovers", "letterboxd", 4.07, "amazon", "movie") },
}

async function extensionPage(page: Page, path: string, ready: string) {
	await page.clock.setFixedTime(NOW)
	await page.goto(`chrome-extension://${extensionId(page.context())}/${path}`)
	await expect(page.locator(ready).first()).toBeVisible()
	// the page's own storage reads were sent first, so they have answered and been drawn once these have
	await page.evaluate(() => Promise.all([chrome.storage.sync.get(), chrome.storage.local.get()]))
	await loaded(page)
}

test("popup", async ({ open }) => {
	const page = await open("about:blank", { viewport: { width: 340, height: 600 }, local: LOCAL })
	await extensionPage(page, "src/ui/action-popup/index.html", ".sb-header")
	// Chromium draws the service dropdown's text a pixel higher on some runs, so that one box is left out
	await expect.soft(page).toHaveScreenshot("popup-settings.png", { mask: [page.locator(".sb-scope select").first()] })
	// the popup stops at the browser's 600px limit and scrolls, so each tab is also shot scrolled to the end
	const content = page.locator(".sb-content")
	await content.evaluate((el) => el.scrollTo(0, el.scrollHeight))
	await expect.soft(page).toHaveScreenshot("popup-settings-end.png")
	await page.getByRole("tab", { name: "Stats" }).click()
	await expect(page.locator(".sb-bars")).toBeVisible()
	await content.evaluate((el) => el.scrollTo(0, 0))
	await expect.soft(page).toHaveScreenshot("popup-stats.png")
	await content.evaluate((el) => el.scrollTo(0, el.scrollHeight))
	await expect.soft(page).toHaveScreenshot("popup-stats-end.png")
})

test("popup on a service streamBuddy doesn't cover", async ({ open }) => {
	const page = await open("about:blank", { viewport: { width: 340, height: 600 }, local: LOCAL })
	// the popup reads the tab it was opened on; here that's Mubi
	await page.addInitScript(() => {
		const tab = { url: "https://mubi.com/en/showing" } as chrome.tabs.Tab
		chrome.tabs.query = (() => Promise.resolve([tab])) as typeof chrome.tabs.query
	})
	await extensionPage(page, "src/ui/action-popup/index.html", ".sb-header")
	await expect(page.getByText("streamBuddy doesn't work on Mubi yet")).toBeVisible()
	await expect.soft(page).toHaveScreenshot("popup-unsupported-site.png", {
		mask: [page.locator(".sb-scope select").first()],
	})
})

// the changelog's entries change every release, so it's drawn with a fixed sample of them
const CHANGELOG_SAMPLE =
	"<h1>Changelog</h1><h2>1.0.1</h2><ul><li>Ratings on episode lists.</li><li>A shorter label on the credits card.</li></ul>" +
	"<h2>1.0.0</h2><ul><li>First release on the Chrome Web Store and Firefox Add-ons.</li></ul>"
const SETTINGS_PAGES: { name: string; route: string; options?: OpenOptions }[] = [
	{ name: "experience", route: "Experience" },
	{ name: "playback", route: "Playback" },
	{ name: "account", route: "Account" },
	{ name: "backup", route: "Backup" },
	{ name: "guide", route: "Guide" },
	{ name: "changelog", route: "Changelog" },
	{ name: "install", route: "install" },
	// the welcome page as a new install from the store first sees it: the built-in key, no account set up
	{ name: "install-fresh", route: "install", options: { signedIn: false } },
]
for (const { name, route, options } of SETTINGS_PAGES) {
	test(`settings page: ${name}`, async ({ open }) => {
		const page = await open("about:blank", { local: LOCAL, ...options })
		await extensionPage(page, `src/ui/options-page/index.html#/options-page/${route}`, "h1")
		// the version number changes every release
		await page.locator(".version").evaluate((el) => (el.textContent = "All settings · v1.0.0"))
		if (route === "Changelog")
			await page.locator(".sb-changelog").evaluate((el, html) => (el.innerHTML = html), CHANGELOG_SAMPLE)
		await expect.soft(page).toHaveScreenshot(`settings-${name}.png`)
		// the page scrolls inside its content column, so a long one is also shot scrolled to the end
		const content = page.locator(".content")
		if (await content.evaluate((el) => el.scrollHeight > el.clientHeight)) {
			await content.evaluate((el) => el.scrollTo(0, el.scrollHeight))
			await expect.soft(page).toHaveScreenshot(`settings-${name}-end.png`)
		}
	})
}

test("card inspector", async ({ open }) => {
	const page = await open("https://www.netflix.com/browse")
	await settle(page, site("netflix").badges)
	const badge = page.locator('[data-shot="standard"] .sb-card-rating').first()
	await badge.hover()
	const inspector = page.locator("[data-sb-inspector]")
	await expect(inspector).toBeVisible({ timeout: 8_000 })
	await expect(inspector.getByText("Amazon Prime Video")).toBeVisible({ timeout: 8_000 })
	await loaded(page)
	await expect.soft(inspector).toHaveScreenshot("netflix-inspector.png")
	await inspector.getByRole("button", { name: "Not this title?" }).click()
	await expect(inspector.getByText("Which title is this?")).toBeVisible()
	await expect(inspector.getByRole("button", { name: /Past Lives/ })).toBeVisible({ timeout: 8_000 })
	await expect.soft(inspector).toHaveScreenshot("netflix-inspector-fix.png")
})

test("episode chips", async ({ open }) => {
	const page = await open("https://www.netflix.com/title/80057281")
	// four episodes, one with no IMDb rating yet
	await expect(page.locator(".sb-episode-rating")).toHaveCount(3, { timeout: 15_000 })
	await loaded(page)
	await expect.soft(page.locator('[data-shot="episodes"]')).toHaveScreenshot("netflix-episodes.png")
})

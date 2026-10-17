import type { Page } from "@playwright/test"
import { test, expect, loaded } from "./harness"
import { PROFILE } from "./ratings"

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
	const id = new URL(page.context().serviceWorkers()[0].url()).host
	await page.clock.setFixedTime(NOW)
	await page.goto(`chrome-extension://${id}/${path}`)
	await expect(page.locator(ready).first()).toBeVisible()
	// the page's own storage reads were sent first, so they have answered and been drawn once these have
	await page.evaluate(() => Promise.all([chrome.storage.sync.get(), chrome.storage.local.get()]))
	await loaded(page)
}

test("popup", async ({ open }) => {
	const page = await open("about:blank", { viewport: { width: 340, height: 600 }, local: LOCAL })
	await extensionPage(page, "src/ui/action-popup/index.html", ".sb-header")
	// Chromium draws the scope dropdown's text a pixel higher on some runs (about 130 pixels); allow that much
	await expect.soft(page).toHaveScreenshot("popup-settings.png", { maxDiffPixels: 150 })
	await page.getByRole("tab", { name: "Stats" }).click()
	await expect(page.locator(".sb-bars")).toBeVisible()
	await expect.soft(page).toHaveScreenshot("popup-stats.png")
	// the popup stops at the browser's 600px limit and scrolls; the titles you spotted are below that
	await page.locator(".sb-content").evaluate((el) => el.scrollTo(0, el.scrollHeight))
	await expect.soft(page).toHaveScreenshot("popup-stats-end.png")
})

for (const route of ["Experience", "Playback", "Account", "Backup", "Guide", "install"]) {
	test(`settings page: ${route}`, async ({ open }) => {
		const page = await open("about:blank", { local: LOCAL })
		await extensionPage(page, `src/ui/options-page/index.html#/options-page/${route}`, "h1")
		// the version number changes every release
		await expect
			.soft(page)
			.toHaveScreenshot(`settings-${route.toLowerCase()}.png`, { fullPage: true, mask: [page.locator(".version")] })
	})
}

test("episode chips", async ({ open }) => {
	const page = await open("https://www.netflix.com/title/80057281")
	// four episodes, one with no IMDb rating yet
	await expect(page.locator(".sb-episode-rating")).toHaveCount(3, { timeout: 15_000 })
	await loaded(page)
	await expect.soft(page.locator('[data-shot="episodes"]')).toHaveScreenshot("netflix-episodes.png")
})

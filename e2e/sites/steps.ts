// The steps that put a loaded page into a captured state: capture.ts takes them on the live site and saves them in
// meta.json, and sites:check takes them again on the live site (--live) or on the copy.
import type { Page } from "@playwright/test"

export type Steps = { seekFromEnd: number | null; click: string | null; hover: string | null; wait: number }

// A copy is already in the state: its video stands where it was seeked to, and it holds what the click or hover
// opened, often over the element itself. There the pointer only goes back to where it was (for :hover styles)
// without waiting for the element to be clear.
export async function putInState(page: Page, steps: Steps, copy: boolean) {
	if (steps.seekFromEnd !== null && !copy) await seekFromEnd(page, steps.seekFromEnd)
	if (steps.click) await page.locator(steps.click).first().click({ force: copy })
	if (steps.hover) await page.locator(steps.hover).first().hover({ force: copy })
	if (!copy) await page.waitForTimeout(steps.wait)
}

async function seekFromEnd(page: Page, seconds: number) {
	await page.waitForFunction(() => Array.from(document.querySelectorAll("video")).some((video) => video.duration > 0))
	// Netflix stops the player if its <video> is seeked directly; it has to go through Netflix's own player
	await page.evaluate((seconds) => {
		const video = Array.from(document.querySelectorAll("video")).sort((a, b) => b.duration - a.duration)[0]
		const target = video.duration - seconds
		type Players = {
			getAllPlayerSessionIds(): string[]
			getVideoPlayerBySessionId(id: string): { seek(ms: number): void }
		}
		const netflix = (
			globalThis as { netflix?: { appContext: { state: { playerApp: { getAPI(): { videoPlayer: Players } } } } } }
		).netflix
		const players = netflix?.appContext.state.playerApp.getAPI().videoPlayer
		if (players) players.getVideoPlayerBySessionId(players.getAllPlayerSessionIds()[0]).seek(target * 1000)
		else video.currentTime = target
	}, seconds)
}

// The steps that put a loaded page into a captured state: capture.ts takes them on the live site and saves them in
// meta.json, and sites:check takes them again on the live site (--live) or on the copy.
import type { Page } from "@playwright/test"

export type Steps = {
	seekFromEnd: number | null
	scroll: number | null
	click: string | null
	hover: string | null
	wait: number
}

// A copy is already in the state: its video stands where it was seeked to, and it holds what the click or hover
// opened, often over the element itself. There the pointer only goes back to where it was (for :hover styles)
// without waiting for the element to be clear.
export async function putInState(page: Page, steps: Steps, copy: boolean) {
	if (steps.seekFromEnd !== null && !copy) await seekFromEnd(page, steps.seekFromEnd)
	// a copy restores its own scroll; live, the page is wheeled down in steps so rows that load on the way appear
	if (steps.scroll && !copy)
		for (let at = 0; at < steps.scroll; at += 600) {
			await page.mouse.wheel(0, Math.min(600, steps.scroll - at))
			await page.waitForTimeout(400)
		}
	if (steps.click) await page.locator(steps.click).first().click({ force: copy })
	if (steps.hover) await page.locator(steps.hover).first().hover({ force: copy })
	if (copy) return
	await page.waitForTimeout(steps.wait)
	// a player hides its controls a few seconds after the pointer stops, so the pointer moves again just before the
	// page is saved, staying on the hovered element
	if (steps.hover) {
		const box = await page.locator(steps.hover).first().boundingBox()
		if (box) await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8, { steps: 4 })
		await page.waitForTimeout(500)
	}
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

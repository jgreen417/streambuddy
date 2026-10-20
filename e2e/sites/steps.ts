// The steps that put a loaded page into a captured state: capture.ts takes them on the live site and saves them in
// meta.json, and sites:check takes them again on the live site (--live) or on the copy.
import type { Page } from "@playwright/test"
import { timelineSeconds } from "./freeze"

export type Steps = {
	seekFromEnd: number | null
	scroll: number | null
	// clicked in order, such as a season menu and then the season (saved before there could be several: a string)
	click: string[] | string | null
	// typed into a field, such as a search box, before the clicks
	fill: { selector: string; text: string } | null
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
	const clicks = [steps.click ?? []].flat()
	if (steps.fill && !copy) {
		await page.locator(steps.fill.selector).first().fill(steps.fill.text)
		await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})
	}
	// a copy holds what was typed; the field only gets the focus filling it left (for :focus styles), if it's there
	if (steps.fill && copy && (await page.locator(steps.fill.selector).count()))
		await page.locator(steps.fill.selector).first().focus()
	// a copy holds what the clicks opened and has no scripts to act on a later one (a menu's option could be a link
	// away), so only the first is taken again, for the focus it left, and only when it's still there (a click that
	// went to another page left that page in the copy); its default action (following a link, ticking a box) is
	// stopped, as the copy already shows what it did
	if (copy && clicks.length && !(await page.locator(clicks[0]).count())) clicks.length = 0
	if (copy && clicks.length)
		await page.evaluate(() =>
			addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true }),
		)
	for (const click of copy ? clicks.slice(0, 1) : clicks) {
		await page.locator(click).first().click({ force: copy })
		if (!copy) await page.waitForTimeout(800)
	}
	// on a copy the hovered element may have given way to what hovering opened
	if (steps.hover && (!copy || (await page.locator(steps.hover).count())))
		await page.locator(steps.hover).first().hover({ force: copy })
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
	// a web-component player keeps its <video> and timeline in open shadow roots
	await page.waitForFunction(() => {
		const roots: (Document | ShadowRoot)[] = [document]
		for (let i = 0; i < roots.length; i++)
			for (const el of Array.from(roots[i].querySelectorAll("*"))) {
				if (el.shadowRoot) roots.push(el.shadowRoot)
				if ((el instanceof HTMLVideoElement && el.duration > 0) || el.matches('[role="slider"][aria-valuemax]'))
					return true
			}
		return false
	})
	// Netflix stops the player if its <video> is seeked directly; it has to go through Netflix's own player
	const live = await page.evaluate((seconds) => {
		// a stream with no end (Infinity) counts as the longest
		const video = Array.from(document.querySelectorAll("video"))
			.map((video) => ({ video, length: Number.isFinite(video.duration) ? video.duration : Number.MAX_VALUE }))
			.sort((a, b) => b.length - a.length)[0]?.video
		// a stream fed in pieces (Disney+) has no length on its <video>, and a web-component player's isn't in the
		// document; the player's timeline is seeked instead
		if (!video || !Number.isFinite(video.duration)) return true
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
		return false
	}, seconds)
	if (live) await seekTimeline(page, seconds)
}

// clicks the player's own timeline at that many seconds before its end, read from the slider's aria values
async function seekTimeline(page: Page, seconds: number) {
	await page.mouse.move(10, 10)
	await page.mouse.move(200, 200, { steps: 4 })
	const slider = page.locator('[role="slider"][aria-valuemax]').first()
	const box = await slider.boundingBox()
	const [min, max] = await Promise.all(
		["aria-valuemin", "aria-valuemax"].map(async (name) => Number((await slider.getAttribute(name)) ?? 0)),
	)
	if (!box || !(max > min)) throw new Error("The player has no timeline to seek, so --seek-from-end can't be used here")
	const end = max - (seconds * (max - min)) / timelineSeconds(min, max)
	await page.mouse.click(box.x + (box.width * (end - min)) / (max - min), box.y + box.height / 2)
}

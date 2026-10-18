import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import type { ProbeReport } from "../sites/probe"
import { loadCapture, routeCapture } from "../sites/replay"
import { putInState, type Steps } from "../sites/steps"
import { measure, specProblems } from "./geometry"
import { expect, loaded, test } from "./harness"
import { seedsFor } from "./ratings"

// The same checks as cards.visual.ts on pages saved from the live sites (e2e/sites, kept in the private
// streambuddy-sites repo): every badge sits to spec, the number drawn and the look match the approved ones.
// Without the saved pages (a fork, or no token for the repo) there is nothing to run.
export const SITES_DIR = path.resolve(process.env.SITES_DIR ?? "e2e/.sites-fixtures/captures")
const states = existsSync(SITES_DIR)
	? readdirSync(SITES_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory())
	: []
test.skip(!states.length, `no saved pages in ${SITES_DIR}`)

for (const { name } of states) {
	test(`saved page: ${name}`, async ({ open }) => {
		const capture = await loadCapture(path.join(SITES_DIR, name))
		const meta = capture.meta as typeof capture.meta & Partial<Steps>
		const probe: ProbeReport = JSON.parse(readFileSync(path.join(capture.dir, "probe.json"), "utf8"))
		const titled = probe.cards.flatMap((card) => (card.title ? [{ title: card.title, mediaType: card.mediaType }] : []))
		const page = await open(meta.url, {
			seeds: seedsFor(titled),
			viewport: meta.viewport,
			route: (context) => routeCapture(context, capture),
		})
		await putInState(
			page,
			{ seekFromEnd: null, scroll: null, click: meta.click ?? null, hover: meta.hover ?? null, wait: 0 },
			true,
		)
		// some titles only resolve after a lookup, so the count is read once it stops changing
		let badges = -1
		await expect
			.poll(
				async () => {
					const before = badges
					badges = await page.locator(".sb-card-rating").count()
					return badges > 0 && badges === before
				},
				{ timeout: 15_000, intervals: [1_000] },
			)
			// a page the site's code says not to rate (Prime's extras) gets none
			.toBe(probe.ratesCards && titled.length > 0)
		await loaded(page)
		await page.waitForTimeout(300)
		expect.soft(String(badges), "badges drawn").toMatchSnapshot(`${name}-badges.txt`)
		// The artwork a badge is measured against is what a viewer sees: the biggest image filling the badge's card, or
		// the rounded box clipping it. Saved pages don't carry the hand-made fixtures' data-sb-art, so it's marked here.
		// A badge the site's code doesn't fit to artwork (Prime's hero, over a title logo) isn't held to the spec.
		const unfitted = probe.cards.flatMap((card) => (card.badge && !card.badge.fit ? [card.badge.host] : []))
		await page.evaluate((unfitted) => {
			for (const badge of Array.from(document.querySelectorAll<HTMLElement>(".sb-card-rating"))) {
				const host = badge.parentElement!
				if (unfitted.some((selector) => selector && host.matches(selector))) continue
				const area = (el: Element) => el.getBoundingClientRect().width * el.getBoundingClientRect().height
				// a title logo over a background (Prime's hero) is no artwork; the card itself is
				const img = Array.from(host.querySelectorAll("img"))
					.filter((el) => area(el) > area(host) / 4)
					.sort((a, b) => area(b) - area(a))[0]
				let art: HTMLElement = img ?? host
				for (let el = img?.parentElement; el && host.contains(el); el = el.parentElement) {
					const style = getComputedStyle(el)
					if (style.overflow !== "visible" && Number.parseFloat(style.borderTopRightRadius) > 0) art = el
					if (el === host) break
				}
				const top = badge.getBoundingClientRect().top - art.getBoundingClientRect().top
				art.dataset.sbArt = ""
				art.dataset.sbCorner = top < art.getBoundingClientRect().height / 2 ? "top" : "bottom"
			}
		}, unfitted)
		expect.soft(specProblems(await measure(page)), "badge placement").toEqual([])
		await expect.soft(page).toHaveScreenshot(`${name}.png`)
	})
}

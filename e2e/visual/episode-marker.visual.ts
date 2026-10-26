import { test, expect } from "@playwright/test"
import { build } from "esbuild"
import path from "node:path"

const cases = [
	{
		site: "netflix",
		title: "Netflix",
		url: "https://www.netflix.com/title/1",
		html: `<div data-uia="modal-motion-container-DETAIL_MODAL"><h3>About Show</h3><div data-uia="previewModal--detailsMetadata"><span class="duration">2 seasons</span></div><div data-uia="episode-selector">${[1, 2].map((n) => `<div data-uia="titleCard--container"><span class="titleCard-title_index">${n}</span></div>`).join("")}</div></div>`,
	},
	{
		site: "prime",
		title: "Prime Video: Show - Season 1",
		url: "https://www.primevideo.com/detail/1",
		html: `<div data-testid="atf-component-next-gen"><h1>Show</h1></div>${[1, 2].map((n) => `<div data-testid="episode-list-item" title="${n}. Episode"><div data-testid="episode-packshot"></div></div>`).join("")}`,
	},
	{
		site: "hbo",
		title: "Show • HBO Max",
		url: "https://www.max.com/show/1",
		html: `<div data-testid="details-hero-container"><button data-testid="play_button" aria-label="Watch Show"></button></div><section data-testid="generic-show-page-rail-episodes-tabbed-content_rail">${[1, 2].map((n) => `<a href="/video/watch/${n}" aria-label="Watch Season 1, Episode ${n}: Episode."><div data-testid="episode_tileImage"></div></a>`).join("")}</section>`,
	},
	{
		site: "disney",
		title: "Show | Disney+",
		url: "https://www.disneyplus.com/browse/entity-1",
		html: `<div data-testid="explore-details-view"></div><div data-testid="masthead-metadata">2024 • 2 Seasons</div><div data-testid="tab-panel--active">${[1, 2].map((n) => `<a data-testid="set-item" aria-label="Season 1 Episode ${n}"><div data-testid="set-item-tile"></div></a>`).join("")}</div>`,
	},
	{
		site: "crunchyroll",
		title: "Show",
		url: "https://www.crunchyroll.com/series/1",
		html: `<h1 class="hero-body__seo-title">Show</h1><div class="erc-playable-collection">${[1, 2].map((n) => `<div data-t="episode-card"><a href="/watch/${n}"><figure></figure></a><h3>E${n} - Episode</h3></div>`).join("")}</div>`,
	},
]

for (const fixture of cases) {
	for (const style of ["classic", "glass"] as const) {
		test(`${fixture.site} ${style}: best episode uses a spaced star without a ring`, async ({ page }) => {
			// Bundle the actual renderer so every service adapter and both style paths execute in a real browser.
			const output = await build({
				entryPoints: [path.resolve("src/utils/page-features.ts"), path.resolve("src/utils/page-feature-styles.ts")],
				bundle: true,
				write: false,
				outdir: "unused",
				format: "iife",
				globalName: "featureModule",
				loader: { ".woff2": "dataurl" },
			})
			await page.route("**/*", (route) =>
				route.fulfill({
					contentType: "text/html",
					body: `<title>${fixture.title}</title><style>body{background:#181818} [data-uia="titleCard--container"],[data-testid="episode-packshot"],[data-testid="episode_tileImage"],[data-testid="set-item-tile"],figure{width:350px;height:100px;margin:20px}</style>${fixture.html}`,
				}),
			)
			await page.goto(fixture.url)
			await page.evaluate(() => {
				Object.assign(window, { browser: { runtime: { getURL: (url: string) => url } } })
			})
			await page.addScriptTag({
				content: output.outputFiles
					.find((f) => f.path.endsWith("page-feature-styles.js"))!
					.text.replace("var featureModule", "var styleModule"),
			})
			await page.addScriptTag({ content: output.outputFiles.find((f) => f.path.endsWith("page-features.js"))!.text })
			await page.evaluate(
				async ({ site, style }) => {
					// The bundle exposes its exports as globals; keep this test-only bridge out of production code.
					const modules = window as unknown as {
						featureModule: typeof import("../../src/utils/page-features")
						styleModule: typeof import("../../src/utils/page-feature-styles")
					}
					const renderer = new modules.featureModule.EpisodeRatings(
						async () => ({ id: 1, title: "Show", media_type: "tv", source: "imdb" }),
						async () => [
							{ id: "tt1", season: 1, episode: 1, title: "One", rating: 8, votes: 100 },
							{ id: "tt2", season: 1, episode: 2, title: "Two", rating: 9, votes: 200 },
						],
					)
					await renderer.tick(site, {
						episodes: true,
						look: modules.styleModule.badgeLook({ badgeStyle: style, glassFrost: 60 }),
					})
				},
				{ site: fixture.site as import("../../src/utils/page-features").FeatureSite, style },
			)
			const chips = page.locator(".sb-episode-rating")
			await expect(chips).toHaveCount(2)
			const best = page.locator('.sb-episode-rating[data-best="true"]')
			await expect(best).toHaveCount(1)
			await expect(best).toHaveAttribute("aria-label", /Best rated episode of the season/)
			const star = (await best.locator(".sb-episode-best").boundingBox())!
			const score = (await best.locator(".sb-episode-score").boundingBox())!
			expect(score.x - star.x - star.width).toBeGreaterThanOrEqual(5)
			expect(await best.evaluate((el) => getComputedStyle(el).boxShadow)).toBe(
				await chips.first().evaluate((el) => getComputedStyle(el).boxShadow),
			)
		})
	}
}

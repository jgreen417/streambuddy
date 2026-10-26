import { test, expect, type Page } from "@playwright/test"
import { build } from "esbuild"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

// The player overlay (skip notices and the speed pill) on a plain page: no fixture plays a video long enough to skip
// something, so overlay.ts is bundled on its own and driven directly. The font is inlined, as the extension bundles it.
const SRC = path.resolve(import.meta.dirname, "../../src")
const NOTICES = [
	{
		name: "notice-skip-intro",
		text: "Skipped intro",
		actions: [{ label: "Undo" }, { label: "Keep intros", quiet: true }],
	},
	{ name: "notice-skip-credits", text: "Skipped credits", actions: [{ label: "Keep credits", quiet: true }] },
	{ name: "notice-paused", text: "Paused after 3 episodes in a row", actions: [{ label: "Keep watching" }] },
]

let bundle: string
test.beforeAll(async () => {
	const result = await build({
		stdin: {
			contents: `
				globalThis.browser = { runtime: { getURL: (url) => url } }
				import { PlayerOverlay } from "@/playback/overlay"
				const overlay = new PlayerOverlay(() => document.getElementById("player"))
				window.notice = (text, actions) => overlay.showNotice(text, actions.map((action) => ({ ...action, run() {} })), 1e9)
				window.speed = (rate, presets) => overlay.renderSpeed(rate, presets, () => {})
			`,
			resolveDir: SRC,
			loader: "ts",
		},
		bundle: true,
		write: false,
		format: "iife",
		logLevel: "error",
		plugins: [
			{
				name: "extension-imports",
				setup(build) {
					build.onResolve({ filter: /^@\// }, ({ path: file }) => ({
						path: path.join(SRC, file.slice(2)) + (file.endsWith(".ts") ? "" : ".ts"),
					}))
					// the bundled font file, as a data URL instead of an extension URL
					build.onResolve({ filter: /\?url$/ }, ({ path: file, resolveDir }) => ({
						path: createRequire(import.meta.url).resolve(file.replace(/\?url$/, ""), { paths: [resolveDir] }),
						namespace: "font",
					}))
					build.onLoad({ filter: /.*/, namespace: "font" }, ({ path: file }) => ({
						contents: `export default "data:font/woff2;base64,${readFileSync(file).toString("base64")}"`,
					}))
				},
			},
		],
	})
	bundle = result.outputFiles[0].text
})

// what the bundle puts on window to drive the overlay
type Driver = {
	notice: (text: string, actions: readonly { label: string; quiet?: boolean }[]) => void
	speed: (rate: number, presets: number[]) => void
}

async function player(page: Page) {
	await page.setViewportSize({ width: 1280, height: 720 })
	await page.setContent(
		`<body style="margin:0"><div id="player" style="width:1280px;height:720px;background:radial-gradient(circle at 40% 40%,#3a4250,#101318 70%)"></div></body>`,
	)
	await page.addScriptTag({ content: bundle })
	await page.evaluate(() => document.fonts.ready)
	return page.locator("[data-streambuddy=player]")
}

for (const { name, text, actions } of NOTICES)
	test(`player overlay: ${name}`, async ({ page }) => {
		const overlay = await player(page)
		await page.evaluate(([text, actions]) => (window as unknown as Driver).notice(text, actions), [
			text,
			actions,
		] as const)
		const notice = overlay.locator(".notice.show")
		await expect(notice).toHaveText(new RegExp(`^${text}`))
		await expect(notice).not.toContainText("saved")
		await expect.soft(notice).toHaveScreenshot(`${name}.png`)
	})

test("player overlay: speed pill, open", async ({ page }) => {
	const overlay = await player(page)
	await page.evaluate(() => (window as unknown as Driver).speed(1.5, [0.75, 1, 1.25, 1.5, 1.75, 2]))
	const speed = overlay.locator(".speed")
	await speed.locator(".value").click()
	await expect(speed).toHaveClass(/open/)
	await expect(speed.locator(".presets").getByRole("button", { name: "1.5×" })).toHaveAttribute("aria-pressed", "true")
	await expect.soft(speed).toHaveScreenshot("speed-pill.png")
})

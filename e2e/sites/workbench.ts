// npm run sites:workbench -- <saved state folder> [--interactive] [--shot out.png]
//   [--settings '{"General":{"badgeStyle":"glass"}}']
//
// Opens a saved page state with the built extension running on it, the way a viewer would see it, without the live
// site. The extension is rebuilt as src/ changes and the page reopens with the new build. A small panel bottom left
// switches the badge settings and sign-in. With --shot it saves one screenshot and exits instead, for checking a
// change without a window. --interactive runs the site's own code from the state's recording (capture.ts --record)
// instead of the frozen page, so hovering, menus and the site's transitions work.
import type { BrowserContext, Page } from "@playwright/test"
import { spawn } from "node:child_process"
import { watch } from "node:fs"
import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import buildExtension from "../visual/global-setup"
import { EXTENSION_DIR, handle, launch, loaded, type OpenOptions } from "../visual/harness"
import { seedsFor } from "../visual/ratings"
import type { ProbeReport } from "./probe"
import { routeRecording } from "./record"
import { loadCapture, routeCapture } from "./replay"
import { putInState } from "./steps"

// lets the routes answer the extension's own requests (its service worker's TMDb lookups), as playwright.config.ts does
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1"

const { values: args, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		shot: { type: "string" },
		settings: { type: "string", default: "{}" },
		interactive: { type: "boolean", default: false },
	},
})
if (!positionals[0]) throw new Error("name the saved state folder to open")
const capture = await loadCapture(path.resolve(positionals[0].replace(/^~/, process.env.HOME ?? "~")))
// null for a service streamBuddy doesn't cover yet
const probe: ProbeReport | null = JSON.parse(await readFile(path.join(capture.dir, "probe.json"), "utf8"))
const seeds = seedsFor(
	(probe?.cards ?? []).flatMap((card) => (card.title ? [{ title: card.title, mediaType: card.mediaType }] : [])),
)

let options: OpenOptions = {
	settings: JSON.parse(args.settings!),
	seeds,
	viewport: capture.meta.viewport,
	route: (context) =>
		args.interactive ? routeRecording(context, capture.dir, handle) : routeCapture(context, capture),
	headless: !!args.shot,
	// the site's own code picks its language, region and layout from these, and the recording holds that path
	browser: args.interactive
		? { locale: capture.meta.language, timezoneId: capture.meta.timeZone, userAgent: capture.meta.userAgent }
		: undefined,
}

type Run = { context: BrowserContext; profileDir: string; page: Page }
async function open(): Promise<Run> {
	const { context, profileDir } = await launch(options)
	const page = await context.newPage()
	if (!args.shot) await addPanel(page)
	// the recording holds the addresses as the live site gave them, before --scrub
	await page.goto(args.interactive ? (capture.live?.url ?? capture.meta.url) : capture.meta.url)
	await loaded(page)
	// a frozen copy gets the focus and hover it was saved with back, as the checks give it
	if (!args.interactive)
		await putInState(
			page,
			{
				seekFromEnd: null,
				scroll: null,
				click: capture.meta.click ?? null,
				fill: capture.meta.fill ?? null,
				hover: capture.meta.hover ?? null,
				wait: 0,
			},
			true,
		)
	return { context, profileDir, page }
}
async function close(run: Run) {
	await run.context.close()
	await rm(run.profileDir, { recursive: true, force: true })
}

// The panel lives in its own shadow root, fixed over the page, so the site's styles and layout don't touch it.
// Its choices come back through a binding, and the page reopens with them.
const PANEL_CHOICES = {
	badgeStyle: ["classic", "glass"],
	friendsStyle: ["labels", "dots", "trio"],
	ratingSources: ["both", "letterboxd", "imdb", "tmdb"],
	signedIn: ["yes", "no"],
}
async function addPanel(page: Page) {
	await page.exposeBinding("sbWorkbench", (_source, choice: Record<string, string>) => {
		options = {
			...options,
			signedIn: choice.signedIn === "yes",
			settings: {
				...options.settings,
				General: {
					...options.settings?.General,
					badgeStyle: choice.badgeStyle,
					friendsStyle: choice.friendsStyle,
					ratingSources: choice.ratingSources,
				},
			},
		}
		reopen()
	})
	const general = options.settings?.General ?? {}
	const current = {
		badgeStyle: String(general.badgeStyle ?? "classic"),
		friendsStyle: String(general.friendsStyle ?? "labels"),
		ratingSources: String(general.ratingSources ?? "both"),
		signedIn: options.signedIn === false ? "no" : "yes",
	}
	await page.addInitScript(
		({ choices, current }) => {
			if (window !== window.top) return
			addEventListener("DOMContentLoaded", () => {
				const host = document.createElement("div")
				host.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647"
				const root = host.attachShadow({ mode: "closed" })
				const rows = Object.entries(choices).map(
					([name, values]) =>
						`<label>${name}<select name="${name}">${values
							.map((value) => `<option${value === current[name] ? " selected" : ""}>${value}</option>`)
							.join("")}</select></label>`,
				)
				root.innerHTML = `<style>
					form { display: grid; gap: 6px; padding: 10px 12px; background: #1b1918ee; color: #fbf4ec;
						font: 12px system-ui; border-radius: 10px; box-shadow: 0 4px 16px #0006 }
					label { display: flex; justify-content: space-between; gap: 10px }
				</style><form>${rows.join("")}</form>`
				const form = root.querySelector("form")!
				form.addEventListener("change", () =>
					(window as unknown as { sbWorkbench: (choice: object) => void }).sbWorkbench(
						Object.fromEntries(new FormData(form)),
					),
				)
				document.documentElement.append(host)
			})
		},
		{ choices: PANEL_CHOICES, current: current as Record<string, string> },
	)
}

let run: Run | undefined
let reopening = Promise.resolve()
function reopen() {
	reopening = reopening.then(async () => {
		if (run) await close(run)
		run = await open()
		console.log(`opened ${capture.meta.state} with build ${new Date().toLocaleTimeString()}`)
	})
	return reopening
}

buildExtension()
if (args.shot) {
	await reopen()
	await run!.page.waitForTimeout(2000)
	await run!.page.screenshot({ path: args.shot })
	await close(run!)
	console.log(`saved ${args.shot}`)
} else {
	await reopen()
	// the same store build as the visual checks, rebuilt on every change to src/
	spawn("npx", ["vite", "build", "--watch", "-c", "vite.chrome.config.ts"], {
		stdio: "ignore",
		env: {
			...process.env,
			NODE_ENV: "production",
			RELEASE: "1",
			STREAMBUDDY_TMDB_KEY: "visual-built-in",
			LETTERBOXD_USERNAME: "",
			OUT_DIR: "e2e/.build",
		},
	})
	let timer: NodeJS.Timeout | undefined
	watch(EXTENSION_DIR, { recursive: true }, () => {
		clearTimeout(timer)
		timer = setTimeout(reopen, 800)
	})
}

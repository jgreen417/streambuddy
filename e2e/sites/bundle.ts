import type { Page } from "@playwright/test"
import { build } from "esbuild"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { CreditsMarker } from "@/utils/credits-markers"
import type { ProbeReport } from "./probe"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
// the name the probe runs under in the page, so its coverage can be picked out from the page's own scripts
export const PROBE_URL = "streambuddy-probe.js"

// probe.ts as one page script, with an inline source map back to src/ for the coverage report. Vite's ?url and ?iife
// imports (the page font, the credits reader's own script) only matter to the built extension, so they come in empty.
export async function bundleProbe(): Promise<string> {
	const result = await build({
		entryPoints: [path.join(ROOT, "e2e/sites/probe.ts")],
		bundle: true,
		format: "iife",
		write: false,
		sourcemap: "inline",
		sourceRoot: ROOT,
		// the extension API, which pages don't have (see extension-stub.ts); the bare `browser` is Vite's auto-import
		alias: { "@": path.join(ROOT, "src"), "webextension-polyfill": path.join(ROOT, "e2e/sites/extension-stub.ts") },
		inject: [path.join(ROOT, "e2e/sites/extension-stub.ts")],
		// the build-time constants Vite fills in; the probe never logs or looks anything up, so any value will do
		define: { __SIDELOAD__: "false", __TMDB_TOKEN__: '""', __LETTERBOXD_USERNAME__: '""' },
		logLevel: "error",
		plugins: [
			{
				name: "vite-imports",
				setup(build) {
					build.onResolve({ filter: /\?(url|iife)$/ }, (args) => ({ path: args.path, namespace: "empty" }))
					build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "export default ''" }))
				},
			},
		],
	})
	return `${result.outputFiles[0].text}\n//# sourceURL=${PROBE_URL}`
}

// evaluated rather than added as a <script>, so the sites' content security policies don't block it
export async function runProbe(
	page: Page,
	service: ProbeReport["service"],
	script: string,
	credits: CreditsMarker[] = [],
) {
	await page.evaluate(script)
	await page.evaluate(
		(markers) => (globalThis as unknown as { sbCredits: (m: CreditsMarker[]) => void }).sbCredits(markers),
		credits,
	)
	const run = () =>
		page.evaluate((name) => (globalThis as unknown as { sbProbe: (s: string) => ProbeReport }).sbProbe(name), service)
	// the first pass starts the lookups some answers wait on (Netflix's episode cards, its player metadata)
	await run()
	await page.waitForTimeout(1500)
	return run()
}

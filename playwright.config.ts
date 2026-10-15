import { defineConfig } from "@playwright/test"

// Lets the tests answer the extension's own requests (its service worker's TMDb lookups) like the pages'.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1"

// Visual checks: the built extension in headless Chromium on saved copies of Netflix, Prime Video and Max.
// npm run test:visual compares against e2e/visual/baselines; npm run test:visual:update accepts the new look.
export default defineConfig({
	testDir: "e2e/visual",
	testMatch: "**/*.visual.ts",
	globalSetup: "./e2e/visual/global-setup.ts",
	outputDir: "e2e/.results",
	snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}",
	fullyParallel: true,
	workers: process.env.CI ? 2 : undefined,
	timeout: 60_000,
	reporter: [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }]],
	expect: {
		toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 30 },
	},
})

import { execSync } from "node:child_process"

// Builds the Chrome extension once per run into e2e/.build/chrome, as a store build: a built-in TMDb key (a stand-in,
// as the harness answers TMDb itself), no Letterboxd name and no reload-on-rebuild alarm, so it behaves like what
// users install.
export default function globalSetup() {
	if (process.env.SB_VISUAL_SKIP_BUILD) return
	execSync(
		"npx cross-env NODE_ENV=production RELEASE=1 STREAMBUDDY_TMDB_KEY=visual-built-in LETTERBOXD_USERNAME= OUT_DIR=e2e/.build vite build -c vite.chrome.config.ts",
		{
			stdio: "inherit",
		},
	)
}

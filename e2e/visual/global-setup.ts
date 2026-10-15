import { execSync } from "node:child_process"

// Builds the Chrome extension once per run into e2e/.build/chrome, as a store build: no TMDb token or Letterboxd
// name baked in and no reload-on-rebuild alarm, so it behaves like what users install.
export default function globalSetup() {
	if (process.env.SB_VISUAL_SKIP_BUILD) return
	execSync(
		"npx cross-env NODE_ENV=production RELEASE=1 TMDB_TOKEN= LETTERBOXD_USERNAME= OUT_DIR=e2e/.build vite build -c vite.chrome.config.ts",
		{
			stdio: "inherit",
		},
	)
}

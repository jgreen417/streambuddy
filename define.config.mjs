import fs from "node:fs"
import packageJson from "./package.json" with { type: "json" }

// Read CHANGELOG.md file into a string.
const changelog = fs.readFileSync("./CHANGELOG.md", "utf-8")

const jsn = (value) => JSON.stringify(value)

// identifies this build; the background reloads the sideloaded extension when dist/ holds a newer one
export const BUILD_ID = String(Date.now())

// Don't forget to add your added variables to vite-env.d.ts also!

// These variables are available in your Vue components and will be replaced by their values at build time.
// These will be compiled into your app. Don't store secrets here!

export const defineViteConfig = {
	__VERSION__: jsn(packageJson.version),
	__NAME__: jsn(packageJson.name),
	__DISPLAY_NAME__: jsn(packageJson.displayName),
	__CHANGELOG__: jsn(changelog),
	__GITHUB_URL__: jsn(packageJson.repository.url),
	__TMDB_TOKEN__: jsn(process.env.TMDB_TOKEN || ""),
	__MAL_CLIENT_ID__: jsn(process.env.MAL_CLIENT_ID || ""),
	// whose friends' ratings to show on Letterboxd badges (optional)
	__LETTERBOXD_USERNAME__: jsn(process.env.LETTERBOXD_USERNAME || ""),
	__BUILD_ID__: jsn(BUILD_ID),
	// false for store builds (npm run build:release): no reload-on-rebuild polling
	__SIDELOAD__: jsn(!process.env.RELEASE),
	// Set the HTML title for all pages from package.json so you can use %HTML_TITLE% in your HTML files.
	HTML_TITLE: jsn(packageJson.displayName),
}

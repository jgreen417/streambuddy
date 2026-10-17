import { env } from "node:process"
import type { ManifestV3Export } from "@crxjs/vite-plugin"
import packageJson from "./package.json" with { type: "json" }
import { SERVICES } from "./src/constants/streamingServices.ts"

const { version, name, description, displayName } = packageJson
// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch] = version
	// can only contain digits, dots, or dash
	.replace(/[^\d.-]+/g, "")
	// split into version parts
	.split(/[.-]/)

export default {
	name: env.mode === "staging" ? `[INTERNAL] ${name}` : displayName || name,
	description,
	// up to four numbers separated by dots
	version: `${major}.${minor}.${patch}`,
	// semver is OK in "version_name"
	// version_name: version,
	manifest_version: 3,
	background: {
		service_worker: "src/background/index.ts",
		type: "module",
	},
	action: {
		default_popup: "src/ui/action-popup/index.html",
	},
	content_scripts: Object.values(SERVICES).map(({ script, matches }) => ({ js: [script], matches: [...matches] })),
	// scripts content scripts put into the page (the credits-marker reader) are reachable only from the streaming sites
	web_accessible_resources: [
		{ resources: ["<dynamic_resource>"], matches: Object.values(SERVICES).flatMap(({ matches }) => [...matches]) },
	],
	options_page: "src/ui/options-page/index.html",
	// alarms only drives the sideloaded copy's reload-on-rebuild check; store builds don't need it
	permissions: env.RELEASE ? ["storage", "activeTab"] : ["storage", "activeTab", "alarms"],
	host_permissions: ["https://letterboxd.com/*", "https://caching.graphql.imdb.com/*"],
	icons: {
		16: "src/assets/Logo/icon-16.png",
		48: "src/assets/Logo/icon-48.png",
		96: "src/assets/Logo/icon-96.png",
		128: "src/assets/Logo/icon-128.png",
		400: "src/assets/Logo/icon-400.png",
	},
	homepage_url: "https://github.com/jgreen417/streambuddy",
} as ManifestV3Export

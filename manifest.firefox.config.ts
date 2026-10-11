import { defineManifest } from "@crxjs/vite-plugin"
import process from "node:process"
import ManifestConfig from "./manifest.config.ts"

export default defineManifest((env) => ({
	...ManifestConfig,
	author: "Josh Green",
	icons: {
		16: "src/assets/Logo/NetflixAmazon Auto-Skip.svg",
		48: "src/assets/Logo/NetflixAmazon Auto-Skip.svg",
		96: "src/assets/Logo/NetflixAmazon Auto-Skip.svg",
		128: "src/assets/Logo/NetflixAmazon Auto-Skip.svg",
		400: "src/assets/Logo/NetflixAmazon Auto-Skip.svg",
	},
	browser_specific_settings: {
		gecko: {
			// permanent: Firefox identifies the add-on by this, so it must never change after the first upload
			id: "streambuddy@jgreen417",
			strict_min_version: "140.0",
			data_collection_permissions: {
				// title names go to TMDb, Letterboxd and IMDb; the user's TMDb key and Letterboxd username go to those sites
				required: ["websiteContent", "authenticationInfo"],
			},
		},
		gecko_android: {
			strict_min_version: "142.0",
		},
	},
	manifest_version: 3,
	background: {
		scripts: ["src/background/index.ts"],
		type: "module",
		persistent: false,
	},
	permissions: [
		"storage",
		"activeTab",
		// alarms only drives the sideloaded copy's reload-on-rebuild check
		...(process.env.RELEASE ? [] : ["alarms"]),
		// Firefox for Android: send a desktop user agent so streaming sites serve their full player
		"webRequest",
		"webRequestBlocking",
		"*://*.disneyplus.com/*",
		"*://*.starplus.com/*",
		"*://*.primevideo.com/*",
		"*://*.amazon.com/*",
		"*://*.amazon.co.jp/*",
		"*://*.amazon.de/*",
		"*://*.amazon.co.uk/*",
		"*://*.max.com/*",
		"*://*.hbomax.com/*",
	],
}))

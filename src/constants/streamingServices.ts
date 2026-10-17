// Every supported service, keyed as in the settings. The other keys are stored too (statsKey in the watch-time log and
// seen-titles lists), so none of them can change. Plain data: the manifests read this file at build time.
export const SERVICES = {
	Netflix: {
		name: "Netflix",
		statsKey: "netflix",
		feature: "netflix",
		script: "src/content-script/netflix.ts",
		matches: ["*://*.netflix.com/*", "*://*.netflix.ca/*", "*://*.netflix.com.au/*"],
		// the popup's check of the tab it was opened on
		host: /(^|\.)netflix\./i,
	},
	Amazon: {
		name: "Prime Video",
		statsKey: "amazon",
		feature: "prime",
		script: "src/content-script/amazon.ts",
		matches: [
			"*://*.primevideo.com/*",
			"*://*.amazon.com/*",
			"*://*.amazon.co.jp/*",
			"*://*.amazon.de/*",
			"*://*.amazon.co.uk/*",
		],
		host: /(^|\.)(amazon|primevideo)\./i,
	},
	HBO: {
		name: "HBO Max",
		statsKey: "hbo",
		feature: "hbo",
		script: "src/content-script/max.ts",
		matches: ["*://*.max.com/*", "*://*.hbomax.com/*"],
		host: /(^|\.)(hbo)?max\.com$/i,
	},
} as const

export type StreamingService = keyof typeof SERVICES
export type FeatureSite = (typeof SERVICES)[StreamingService]["feature"]

export const streamingServices = Object.keys(SERVICES) as StreamingService[]

// display names by the key the stats are stored under
export const SERVICE_NAMES_BY_STATS_KEY: Record<string, string> = Object.fromEntries(
	Object.values(SERVICES).map((service) => [service.statsKey, service.name]),
)

// "Netflix, Prime Video and HBO Max", for copy that says where streamBuddy works
const names = streamingServices.map((service) => SERVICES[service].name)
export const SUPPORTED_SERVICE_NAMES = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`

// Services streamBuddy doesn't cover yet. The popup names one when it's opened on its site and offers a request.
export const OTHER_SERVICES = [
	{ name: "Disney+", host: /(^|\.)disneyplus\.com$/i },
	{ name: "Apple TV+", host: /^tv\.apple\.com$/i },
	{ name: "Paramount+", host: /(^|\.)paramountplus\.com$/i },
	{ name: "Hulu", host: /(^|\.)hulu\.com$/i },
	{ name: "Peacock", host: /(^|\.)peacocktv\.com$/i },
	{ name: "Stan", host: /(^|\.)stan\.com\.au$/i },
	{ name: "Binge", host: /(^|\.)binge\.com\.au$/i },
	{ name: "Crunchyroll", host: /(^|\.)crunchyroll\.com$/i },
	{ name: "Mubi", host: /(^|\.)mubi\.com$/i },
	{ name: "the Criterion Channel", host: /(^|\.)criterionchannel\.com$/i },
]

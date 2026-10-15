// The fixture pages and what each should show. `badges` counts every badge expected on the page; `shots` are the
// page sections (data-shot) screenshotted and compared against the committed baselines.
export type Site = { name: string; url: string; badges: number; shots: string[] }

export const SITES: Site[] = [
	{
		name: "netflix",
		url: "https://www.netflix.com/browse",
		badges: 27,
		shots: ["standard", "standard-tags", "progress", "ranked", "episodic", "narrow"],
	},
	{
		name: "prime",
		url: "https://www.primevideo.com/storefront/home",
		badges: 14,
		shots: ["hero", "carousel", "carousel-wide", "super"],
	},
	{ name: "max", url: "https://play.max.com/", badges: 9, shots: ["posters", "landscape"] },
]
export const site = (name: string) => SITES.find((entry) => entry.name === name)!

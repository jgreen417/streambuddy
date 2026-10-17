import type { Page } from "@playwright/test"
import type { StreamingService } from "@/constants/streamingServices"

// Every saved page state, by the URL the harness answers it on. A state is one cell of the service × surface ×
// state grid; prepare puts the page into it (a hover, a scroll) after it loads.
export type SiteState = {
	name: string
	service: StreamingService
	url: string
	viewport?: { width: number; height: number }
	prepare?: (page: Page) => Promise<void>
}

export const STATES: SiteState[] = [
	{ name: "netflix-browse", service: "Netflix", url: "https://www.netflix.com/browse" },
	{
		name: "netflix-browse-narrow",
		service: "Netflix",
		url: "https://www.netflix.com/browse",
		viewport: { width: 900, height: 900 },
	},
	{ name: "netflix-title", service: "Netflix", url: "https://www.netflix.com/title/80057281" },
	{ name: "netflix-player-credits", service: "Netflix", url: "https://www.netflix.com/watch/81572766" },
	{ name: "prime-home", service: "Amazon", url: "https://www.primevideo.com/storefront/home" },
	{
		name: "prime-home-hover",
		service: "Amazon",
		url: "https://www.primevideo.com/storefront/home",
		prepare: (page) => page.locator('article[data-testid="super-carousel-card"]').first().hover(),
	},
	{ name: "max-home", service: "HBO", url: "https://play.max.com/" },
]

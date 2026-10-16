import { installPageFeatureStyle } from "./page-feature-styles"
import { getScoreColor, type RatingSource } from "./ratings"

export type FeatureSite = "netflix" | "hbo" | "prime"
export type DetailContext = {
	root: HTMLElement
	target: HTMLElement
	before?: HTMLElement
	title: string
	year: string | null
	mediaType: "movie" | "tv" | null
}
export type FeatureRating = {
	id: number
	title: string
	media_type: string
	source: RatingSource
	rating?: number
	score?: number
	rating_count?: number
	rating_url?: string
	friends_rating?: number
	friends_count?: number
	friends?: { name: string; rating: number }[]
}
export type EpisodeRating = {
	id: string
	season: number
	episode: number
	title: string
	rating: number
	votes: number
}
// sites wrap labels in invisible direction marks (U+200E, U+2066…), which break ^-anchored matches
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g
const clean = (value: string | null | undefined) => (value ?? "").replace(BIDI_MARKS, "").trim()
const text = (element: Element | null) => clean(element?.textContent)
// a heading's own text, or its title-art image's alt text when the title is a logo
const headingText = (element: Element | null) =>
	text(element) || clean(element?.querySelector("img[alt]")?.getAttribute("alt"))

export function readDetailContext(site: FeatureSite, path = location.pathname): DetailContext | null {
	if (site === "netflix") {
		const root = document.querySelector<HTMLElement>('[data-uia="modal-motion-container-DETAIL_MODAL"]')
		const target = root?.querySelector<HTMLElement>('[data-uia="previewModal--detailsMetadata"]')
		// the "About <title>" heading has sat both inside and just outside the about container
		const headings = Array.from(root?.querySelectorAll(":is(h1,h2,h3,h4)") ?? [])
		const about =
			root?.querySelector('[data-uia="about-container"] :is(h1,h2,h3,h4)') ??
			headings.find((heading) => /^About\s+/i.test(text(heading))) ??
			null
		const title = text(about).replace(/^About\s+/i, "")
		if (!root || !target || !title) return null
		return {
			root,
			target,
			title,
			year: text(root.querySelector(".year")) || null,
			mediaType:
				root.querySelector('[data-uia="episode-selector"]') ||
				/episodes|seasons/i.test(text(root.querySelector(".duration")))
					? "tv"
					: "movie",
		}
	}
	if (site === "hbo") {
		const hero = document.querySelector<HTMLElement>('[data-testid="details-hero-container"]')
		if (!hero) return null
		const button = hero.querySelector('[data-testid="play_button"]')
		const series =
			/\/show\//.test(path) ||
			!!document.querySelector('[data-testid="generic-show-page-rail-episodes-tabbed-content_rail"]')
		const title = series
			? clean(document.title.split(/\s*[•·]\s*/)[0])
			: // "Watch Dune", or "Watch again: Dune" once it's been seen
				clean(button?.getAttribute("aria-label"))
					.replace(/^(?:Watch(?:\s+again)?|Resume|Continue(?:\s+watching)?)\s*:?\s+/i, "")
					.trim()
		if (!title) return null
		return {
			root: document.body,
			target: hero,
			title,
			year: text(hero.querySelector('[data-testid="metadata_release_year"]')) || null,
			mediaType: series ? "tv" : "movie",
		}
	}
	const target = document.querySelector<HTMLElement>('[data-testid="atf-component-next-gen"]')
	const title = headingText(target?.querySelector("h1") ?? null).replace(/\s*-\s*Season\s+\d+.*$/i, "")
	if (!target || !title) return null
	return {
		root: document.body,
		target,
		before: target.querySelector<HTMLElement>('[data-testid="dp-atf-synopsis"]') ?? undefined,
		title,
		year: text(target.querySelector('[data-testid="release-year-badge"]')) || null,
		mediaType:
			/Season\s+\d+/i.test(document.title) || document.querySelector('[data-testid="episode-list-item"]') ? "tv" : null,
	}
}

export function readEpisodeCards(site: FeatureSite, root: HTMLElement) {
	const cards: { card: HTMLElement; target: HTMLElement; season: number; episode: number }[] = []
	if (site === "netflix") {
		const season = Number(text(root.querySelector('[data-uia="dropdown-toggle"]')).match(/(\d+)\s*$/)?.[1] ?? 1)
		root
			.querySelectorAll<HTMLElement>('[data-uia="episode-selector"] [data-uia="titleCard--container"]')
			.forEach((card) => {
				const episode = Number(text(card.querySelector(".titleCard-title_index")))
				if (episode > 0) cards.push({ card, target: card, season, episode })
			})
	} else if (site === "hbo") {
		root
			.querySelectorAll<HTMLElement>(
				'[data-testid="generic-show-page-rail-episodes-tabbed-content_rail"] a[href^="/video/watch/"]',
			)
			.forEach((card) => {
				const match = card.getAttribute("aria-label")?.match(/Season\s+(\d+),\s*Episode\s+(\d+)/i)
				if (match)
					cards.push({
						card,
						target: card.querySelector<HTMLElement>('[data-testid$="_tileImage"]') ?? card,
						season: Number(match[1]),
						episode: Number(match[2]),
					})
			})
	} else {
		const season = Number(document.title.match(/Season\s+(\d+)/i)?.[1])
		if (!season) return cards
		root.querySelectorAll<HTMLElement>('[data-testid="episode-list-item"]').forEach((card) => {
			const label = card.getAttribute("title") || text(card.querySelector("h2,h3")) || text(card)
			const episode = Number(label.match(/^\s*(\d+)\./)?.[1] ?? label.match(/Episode\s+(\d+)/i)?.[1])
			if (episode > 0)
				cards.push({
					card,
					target: card.querySelector<HTMLElement>('[data-testid="episode-packshot"]') ?? card,
					season,
					episode,
				})
		})
	}
	return cards
}

// IMDb scores beside each episode on a series' title page
export class EpisodeRatings {
	private info = new Map<string, Promise<FeatureRating | null>>()
	private episodes = new Map<string, Promise<EpisodeRating[]>>()
	private nextRetry = new Map<string, number>()
	private active = ""
	constructor(
		private lookup: (title: string, type: "movie" | "tv" | null, year: string | null) => Promise<FeatureRating | null>,
		private lookupEpisodes: (data: FeatureRating, season: number) => Promise<EpisodeRating[]>,
	) {}
	async tick(
		site: FeatureSite,
		// sources: the rating-source setting; results looked up under another one are not reused
		options: { episodes: boolean; sources?: string },
		path = location.pathname,
	) {
		const context = readDetailContext(site, path)
		const active = `${site}|${path}|${context?.title}|${context?.mediaType}|${context?.year}|${options.episodes}|${options.sources}`
		if (this.active !== active) {
			document.querySelectorAll(".sb-episode-rating").forEach((el) => el.remove())
			document.querySelectorAll(".sb-episode-host").forEach((el) => el.classList.remove("sb-episode-host"))
		}
		this.active = active
		if (!options.episodes) return
		// films have no episodes to rate
		if (!context || context.mediaType === "movie") return
		const key = `${context.title}|${context.mediaType}|${context.year}`
		const lookupKey = `${key}|${options.sources ?? ""}`
		if ((this.nextRetry.get(lookupKey) ?? 0) > Date.now()) return
		let pending = this.info.get(lookupKey)
		if (!pending) {
			pending = this.lookup(context.title, context.mediaType, context.year)
			this.info.set(lookupKey, pending)
		}
		const data = await pending.catch(() => null)
		if (!data) {
			this.info.delete(lookupKey)
			this.nextRetry.set(lookupKey, Date.now() + 30_000)
			return
		}
		const current = readDetailContext(site, location.pathname === path ? path : location.pathname)
		if (
			this.active !== active ||
			!current ||
			current.target !== context.target ||
			`${current.title}|${current.mediaType}|${current.year}` !== key
		)
			return
		if (data.media_type !== "tv") return
		installPageFeatureStyle()
		const cards = readEpisodeCards(site, context.root)
		const currentEpisodes = new Map(cards.map((entry) => [entry.target, `${data.id}|${entry.season}|${entry.episode}`]))
		context.root.querySelectorAll<HTMLElement>(".sb-episode-rating").forEach((chip) => {
			const target = chip.parentElement
			if (!target || currentEpisodes.get(target) !== chip.dataset.episodeKey) {
				chip.remove()
				target?.classList.remove("sb-episode-host")
			}
		})
		await Promise.all(
			[...new Set(cards.map((card) => card.season))].map(async (season) => {
				const episodeKey = `${data.id}|${season}`
				if ((this.nextRetry.get(episodeKey) ?? 0) > Date.now()) return
				let pending = this.episodes.get(episodeKey)
				if (!pending) {
					pending = this.lookupEpisodes(data, season)
					this.episodes.set(episodeKey, pending)
				}
				const ratings = await pending.catch(() => null)
				if (!ratings) {
					this.episodes.delete(episodeKey)
					this.nextRetry.set(episodeKey, Date.now() + 30_000)
					return
				}
				const now = readDetailContext(site)
				if (this.active !== active || !now || now.target !== context.target || now.title !== context.title) return
				for (const entry of readEpisodeCards(site, context.root).filter((card) => card.season === season)) {
					const rating = ratings.find((r) => r.season === entry.season && r.episode === entry.episode)
					const old = entry.target.querySelector<HTMLElement>(".sb-episode-rating")
					if (old?.dataset.episodeKey === `${data.id}|${season}|${entry.episode}`) continue
					old?.remove()
					if (!rating?.rating) continue
					entry.target.classList.add("sb-episode-host")
					const chip = document.createElement("a")
					chip.className = "sb-episode-rating"
					chip.dataset.episodeKey = `${data.id}|${season}|${entry.episode}`
					chip.href = `https://www.imdb.com/title/${rating.id}/`
					chip.target = "_blank"
					chip.rel = "noopener noreferrer"
					chip.textContent = `IMDb ${rating.rating.toFixed(1)}`
					chip.title = `S${season} E${entry.episode}: ${rating.title} · ${rating.votes.toLocaleString()} ratings`
					chip.style.color = getScoreColor("imdb", rating.rating)
					chip.addEventListener("click", (event) => event.stopPropagation())
					entry.target.append(chip)
				}
			}),
		)
	}
}

export class SearchRatingSort {
	private ratings = new WeakMap<HTMLElement, number>()
	private grids = new Map<
		HTMLElement,
		{ sorted: boolean; button: HTMLButtonElement; orders: Map<HTMLElement, [string, string]> }
	>()
	setRating(card: HTMLElement, score: number) {
		this.ratings.set(card, score)
	}
	forgetRating(card: HTMLElement) {
		this.ratings.delete(card)
	}
	update(grid: HTMLElement) {
		installPageFeatureStyle()
		let state = this.grids.get(grid)
		if (!state) {
			const button = document.createElement("button")
			button.className = "sb-search-sort sb-feature-button"
			button.type = "button"
			state = { sorted: false, button, orders: new Map() }
			this.grids.set(grid, state)
			button.addEventListener("click", () => {
				state!.sorted = !state!.sorted
				this.update(grid)
			})
			grid.before(button)
		}
		const label = state.sorted ? "Restore site order" : "Sort by rating"
		if (state.button.textContent !== label) state.button.textContent = label
		state.button.setAttribute("aria-pressed", String(state.sorted))
		const children = Array.from(grid.children) as HTMLElement[]
		if (!state.sorted) {
			for (const [child, [value, priority]] of state.orders) {
				if (value) child.style.setProperty("order", value, priority)
				else child.style.removeProperty("order")
			}
			state.orders.clear()
			return
		}
		const scoreFor = (child: HTMLElement) =>
			this.ratings.get(child) ??
			Array.from(child.querySelectorAll<HTMLElement>("a,article"))
				.map((el) => this.ratings.get(el))
				.find((value) => value !== undefined) ??
			-1
		const sorted = [...children].sort((a, b) => scoreFor(b) - scoreFor(a))
		for (const [index, child] of sorted.entries()) {
			if (!state.orders.has(child))
				state.orders.set(child, [child.style.getPropertyValue("order"), child.style.getPropertyPriority("order")])
			if (child.style.order !== String(index)) child.style.setProperty("order", String(index))
		}
	}
	clear() {
		for (const [grid, state] of this.grids) {
			state.sorted = false
			this.update(grid)
			state.button.remove()
		}
		this.grids.clear()
	}
}

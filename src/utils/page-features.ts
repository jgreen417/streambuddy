import { classicLook, installPageFeatureStyle, type BadgeLook } from "./page-feature-styles"
import type { RatingSource } from "./ratings"
import { getScoreColor } from "./rating-sources"
import { parseEpisodeLabel } from "./series-finale"

import type { FeatureSite } from "@/constants/streamingServices"
export type { FeatureSite }
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
export const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g
const clean = (value: string | null | undefined) => (value ?? "").replace(BIDI_MARKS, "").trim()
const text = (element: Element | null) => clean(element?.textContent)
// a heading's own text, or its title-art image's alt text when the title is a logo
const headingText = (element: Element | null) =>
	text(element) || clean(element?.querySelector("img[alt]")?.getAttribute("alt"))

// "Season 2" in the languages of Prime's Amazon sites (Hindi on amazon.in)
const primeSeason = /(?:Season|Staffel|Saison|Temporada|Stagione|सीज़न)\s+(\d+)/i

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
	if (site === "disney") {
		// "2009 – 2015 • 6 Seasons • Drama", in the profile's language; failing that, an episode list
		const seasons = /\b\d+\s+(?:Seasons?|Staffeln?|Saisons?|Temporadas?|Stagion[ei]|Seizoen(?:en)?)\b/i
		const target = document.querySelector<HTMLElement>('[data-testid="explore-details-view"]')
		const masthead = text(document.querySelector('[data-testid="masthead-metadata"]'))
		// the title is a logo; the tab title is "Glee | Disney+"
		const title = clean(document.title.replace(/\s*\|\s*Disney\+$/, ""))
		if (!target || !title || !/^(?:\/[a-z]{2}(?:-(?:[a-z]{2}|\d{3}))?)?\/browse\/entity-/i.test(location.pathname))
			return null
		return {
			root: document.body,
			target,
			title,
			year: masthead.match(/^\d{4}/)?.[0] ?? null,
			mediaType: seasons.test(masthead) || disneyEpisodeCards(document).length ? "tv" : "movie",
		}
	}
	if (site === "crunchyroll") {
		// a film is a series page too, with one video and no episode list
		const target = document.querySelector<HTMLElement>('[class*="hero-body__seo-title"]')
		const title = text(target)
		if (!target || !title) return null
		return {
			root: document.body,
			target,
			title,
			year: null,
			mediaType: crunchyrollEpisodeCards(document).length ? "tv" : null,
		}
	}
	if (site === "tubi") {
		// a series' page, or an episode's, which lists the season's episodes under its player; the visible title is a
		// logo, and a hidden h1 names the show
		const target = document.querySelector<HTMLElement>("h1")
		const title = text(target)
		if (!target || !title || !/^\/(?:series|tv-shows)\//.test(path)) return null
		return { root: document.body, target, title, year: null, mediaType: "tv" }
	}
	const target = document.querySelector<HTMLElement>('[data-testid="atf-component-next-gen"]')
	const title = headingText(target?.querySelector("h1") ?? null).replace(
		/\s*-\s*(?:Season|Staffel|Saison|Temporada|Stagione|सीज़न)\s+\d+.*$/i,
		"",
	)
	if (!target || !title) return null
	return {
		root: document.body,
		target,
		before: target.querySelector<HTMLElement>('[data-testid="dp-atf-synopsis"]') ?? undefined,
		title,
		year: text(target.querySelector('[data-testid="release-year-badge"]')) || null,
		mediaType:
			primeSeason.test(document.title) || document.querySelector('[data-testid="episode-list-item"]') ? "tv" : null,
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
	} else if (site === "disney") {
		cards.push(...disneyEpisodeCards(root))
	} else if (site === "crunchyroll") {
		cards.push(...crunchyrollEpisodeCards(root))
	} else if (site === "tubi") {
		cards.push(...tubiEpisodeCards(root))
	} else {
		const season = Number(document.title.match(primeSeason)?.[1])
		if (!season) return cards
		root.querySelectorAll<HTMLElement>('[data-testid="episode-list-item"]').forEach((card) => {
			const label = card.getAttribute("title") || text(card.querySelector("h2,h3")) || text(card)
			const episode = Number(
				label.match(/^\s*(\d+)\./)?.[1] ?? label.match(/(?:Episode|Folge|Épisode|Episodio|एपिसोड)\s+(\d+)/i)?.[1],
			)
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

// the rounding of an episode thumbnail's bottom-right corner, where the chip sits: on the thumbnail or its image
function episodeCornerRadius(target: HTMLElement) {
	const radius = (el: Element | null) => {
		const value = el ? getComputedStyle(el).borderBottomRightRadius : ""
		return value.endsWith("px") ? Number.parseFloat(value) || 0 : 0
	}
	return Math.max(radius(target), radius(target.querySelector("img")))
}

// how far a watched episode's progress bar reaches up from the thumbnail's bottom edge (Max), for the chip to sit above
function progressBarHeight(target: HTMLElement) {
	const bar = target.querySelector('[data-testid="progress-bar"]')
	return bar ? Math.max(target.getBoundingClientRect().bottom - bar.getBoundingClientRect().top, 0) : 0
}

// Netflix lists an episode's length at the right of its title row: the chip lines its left edge up with that text,
// kept inside the card. The rects are scaled while Netflix's modal animates, so the offset is converted back.
function alignWithDuration(chip: HTMLElement, target: HTMLElement) {
	const duration = target.querySelector(".titleCard-duration .duration")?.getBoundingClientRect()
	const card = target.getBoundingClientRect()
	if (!duration?.width || !target.offsetWidth) {
		chip.style.removeProperty("left")
		chip.style.removeProperty("right")
		return
	}
	const offset = (duration.left - card.left) / (card.width / target.offsetWidth) - target.clientLeft
	const left = `${Math.max(3, Math.min(offset, target.clientWidth - chip.offsetWidth - 3))}px`
	if (chip.style.left !== left) {
		chip.style.left = left
		chip.style.right = "auto"
	}
}

// IMDb scores beside each episode on a series' title page
export class EpisodeRatings {
	private info = new Map<string, Promise<FeatureRating | null>>()
	private episodes = new Map<string, Promise<EpisodeRating[]>>()
	private nextRetry = new Map<string, number>()
	private active = ""
	// after the rating cache is cleared: look the open page's title up again and redraw its chips
	forget() {
		this.info.clear()
		this.nextRetry.clear()
		this.active = ""
	}
	constructor(
		private lookup: (title: string, type: "movie" | "tv" | null, year: string | null) => Promise<FeatureRating | null>,
		private lookupEpisodes: (data: FeatureRating, season: number) => Promise<EpisodeRating[]>,
	) {}
	async tick(
		site: FeatureSite,
		// sources: the rating-source setting; results looked up under another one are not reused
		// look: the card badges' look, so the episode chips match them
		options: { episodes: boolean; sources?: string; look?: BadgeLook },
		path = location.pathname,
	) {
		const { look = classicLook } = options
		const context = readDetailContext(site, path)
		const active = `${site}|${path}|${context?.title}|${context?.mediaType}|${context?.year}|${options.episodes}|${options.sources}|${look.id}`
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
				// One episode is the best of the season only when it is the unique highest score. Ties and
				// single-rated seasons say nothing useful, so they get no marker.
				const rated = ratings.filter((episode) => episode.rating > 0)
				const top = rated.length > 1 ? Math.max(...rated.map((episode) => episode.rating)) : null
				const best = top !== null && rated.filter((episode) => episode.rating === top).length === 1 ? top : null
				for (const entry of readEpisodeCards(site, context.root).filter((card) => card.season === season)) {
					const rating = ratings.find((r) => r.season === entry.season && r.episode === entry.episode)
					const old = entry.target.querySelector<HTMLElement>(".sb-episode-rating")
					if (old?.dataset.episodeKey === `${data.id}|${season}|${entry.episode}`) {
						alignWithDuration(old, entry.target)
						continue
					}
					old?.remove()
					if (!rating?.rating) continue
					entry.target.classList.add("sb-episode-host")
					const chip = document.createElement("a")
					chip.className = "sb-episode-rating"
					chip.dataset.episodeKey = `${data.id}|${season}|${entry.episode}`
					chip.href = `https://www.imdb.com/title/${rating.id}/`
					chip.target = "_blank"
					chip.rel = "noopener noreferrer"
					const score = document.createElement("span")
					score.className = "sb-episode-score"
					score.style.background = getScoreColor("imdb", rating.rating)
					score.textContent = rating.rating.toFixed(1)
					const source = document.createElement("span")
					source.className = "sb-episode-source"
					source.textContent = "IMDb"
					const isBest = best !== null && rating.rating === best
					if (isBest) {
						const star = document.createElement("span")
						star.className = "sb-episode-best"
						star.textContent = "★"
						star.setAttribute("aria-hidden", "true")
						chip.append(star)
					}
					chip.append(score, source)
					if (isBest) chip.dataset.best = "true"
					look.apply(chip)
					const radius = episodeCornerRadius(entry.target)
					chip.style.setProperty("--sb-badge-r", `${Math.max(radius - 3, 2)}px`)
					chip.style.setProperty("--sb-pill-r", `${Math.max(radius - 6, 2)}px`)
					const bar = progressBarHeight(entry.target)
					if (bar) chip.style.bottom = `${bar + 3}px`
					chip.title = `S${season} E${entry.episode}: ${rating.title} · ${rating.votes.toLocaleString()} ratings${isBest ? " · Best rated episode of the season" : ""}`
					chip.setAttribute("aria-label", `IMDb ${rating.rating.toFixed(1)}, ${chip.title}`)
					chip.addEventListener("click", (event) => event.stopPropagation())
					entry.target.append(chip)
					alignWithDuration(chip, entry.target)
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
			const created = { sorted: false, button, orders: new Map<HTMLElement, [string, string]>() }
			button.addEventListener("click", () => {
				created.sorted = !created.sorted
				this.update(grid)
			})
			grid.before(button)
			this.grids.set(grid, created)
			state = created
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

// a Disney+ series' episode tiles, labelled "Season 1 Episode 3 …" in the profile's language
function disneyEpisodeCards(root: ParentNode) {
	return Array.from(
		root.querySelectorAll<HTMLElement>('[data-testid="tab-panel--active"] a[data-testid="set-item"]'),
		(card) => {
			const place = parseEpisodeLabel(card.getAttribute("aria-label")?.slice(0, 40))
			const target = card.querySelector<HTMLElement>('[data-testid="set-item-tile"]') ?? card
			return place && { card, target, ...place }
		},
	).filter((card) => card !== null)
}

// a Crunchyroll series' episode cards, titled "E3 - Killing Magic", under its season picker ("Season 2")
function crunchyrollEpisodeCards(root: ParentNode) {
	// the picker reads "Season 2" in the profile's language, or "Season 1 Part 2"
	const season = Number(text(document.querySelector('.erc-seasons-select [role="button"]')).match(/\d+/)?.[0] ?? 1)
	return Array.from(root.querySelectorAll<HTMLElement>('.erc-playable-collection [data-t^="episode-card"]'), (card) => {
		const episode = Number(text(card.querySelector("h3")).match(/^E(\d+)\b/)?.[1])
		const target = card.querySelector<HTMLElement>("a:has(figure)") ?? card
		return episode > 0 ? { card, target, season, episode } : null
	}).filter((card) => card !== null)
}

// a Tubi season's episode cards, each a link titled "S01:E03 - Lover Come Hack to Me", with a 16:9 thumbnail first
function tubiEpisodeCards(root: ParentNode) {
	return Array.from(root.querySelectorAll<HTMLElement>('a[href^="/tv-shows/"]:has(h3)'), (card) => {
		const place = parseEpisodeLabel(text(card.querySelector("h3")))
		const target = card.querySelector("img")?.parentElement ?? card
		return place ? { card, target, ...place } : null
	}).filter((card) => card !== null)
}

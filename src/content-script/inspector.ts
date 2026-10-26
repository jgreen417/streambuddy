// The card inspector: a small, on-demand popover that makes the badge's hidden context readable — who rated it,
// how many people voted, and where else it is streaming. It lives in a shadow root so the site's CSS can't reach it.
import { sendMessage } from "webext-bridge/content-script"
import { SERVICES, searchOn, streamingServices, type StreamingService } from "@/constants/streamingServices"
import { color, cssDeclarations, friendColors, palette, serviceColors } from "@/design/tokens"
import { installPageFont } from "@/utils/page-feature-styles"
import { RATING_SOURCES, getScoreColor } from "@/utils/rating-sources"
import { getLetterboxdSlug } from "@/utils/ratings"
import { deleteCached, type MovieInfo } from "./cache"
import { saveOverride } from "./overrides"
import { letterboxdUsername, type PersonalStatus } from "./profile"

export type ProviderKind = "flatrate" | "free" | "ads" | "rent" | "buy"
export type ProviderRow = { name: string; kind: ProviderKind }
export type Availability = { rows: ProviderRow[]; link?: string }

const KIND_ORDER: Record<ProviderKind, number> = { flatrate: 0, free: 1, ads: 2, rent: 3, buy: 4 }
const KIND_LABEL: Record<ProviderKind, string> = {
	flatrate: "Included",
	free: "Free",
	ads: "Free with ads",
	rent: "Rent",
	buy: "Buy",
}
// TMDb names, so the service the viewer is already on is not repeated as an "also on" row
const SERVICE_PROVIDER: Record<StreamingService, RegExp> = {
	Netflix: /^Netflix$/i,
	Amazon: /^(Amazon )?Prime Video$/i,
	HBO: /^(Max|HBO Max)$/i,
	Disney: /^Disney(\+| Plus)$/i,
	Crunchyroll: /^Crunchyroll$/i,
}

const providerCache = new Map<string, Promise<Availability | null>>()
// opened once, "Where to watch" stays open on later cards until the page reloads
let whereOpen = false

// TMDb's watch/providers for this title in the viewer's region; null means the request failed, an empty row list
// means the title is not listed there. Prices are not in TMDb, so the rows say Rent/Buy, never a made-up price.
export function parseProviders(json: unknown, region: string): Availability | null {
	const results = (json as { results?: Record<string, Record<string, unknown>> } | null)?.results
	if (!results) return null
	const entry = results[region]
	if (!entry) return { rows: [] }
	const rows = new Map<string, ProviderKind>()
	const add = (list: unknown, kind: ProviderKind) => {
		if (!Array.isArray(list)) return
		for (const item of list) {
			const name = (item as { provider_name?: unknown })?.provider_name
			if (typeof name !== "string" || !name) continue
			const existing = rows.get(name)
			if (!existing || KIND_ORDER[kind] < KIND_ORDER[existing]) rows.set(name, kind)
		}
	}
	add(entry.flatrate, "flatrate")
	add(entry.free, "free")
	add(entry.ads, "ads")
	add(entry.rent, "rent")
	add(entry.buy, "buy")
	return {
		rows: [...rows]
			.map(([name, kind]) => ({ name, kind }))
			.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name))
			.slice(0, 5),
		link: typeof entry.link === "string" ? entry.link : undefined,
	}
}

// the first of the browser's languages that names a country; the panel says which one it used
function region(): string {
	for (const language of navigator.languages ?? [navigator.language]) {
		const country = /-([a-z]{2})$/i.exec(language)?.[1]
		if (country) return country.toUpperCase()
	}
	return "US"
}

function loadProviders(data: MovieInfo): Promise<Availability | null> {
	if (!data.id || (data.media_type !== "movie" && data.media_type !== "tv")) return Promise.resolve(null)
	const key = `${data.media_type}|${data.id}|${region()}`
	let pending = providerCache.get(key)
	if (!pending) {
		pending = sendMessage(
			"fetch",
			{
				url: `https://api.themoviedb.org/3/${data.media_type}/${data.id}/watch/providers`,
				type: "tmdb",
			},
			"background",
		)
			.then((json) => parseProviders(json, region()))
			.catch(() => null)
			.then((result) => {
				// a failed lookup is tried again next time rather than remembered
				if (!result) providerCache.delete(key)
				return result
			})
		providerCache.set(key, pending)
	}
	return pending
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") => {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (text) node.textContent = text
	return node
}
const count = (value: number) =>
	value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${Math.round(value / 1e3)}K` : String(value)
function stars(rating: number) {
	const full = Math.floor(rating)
	const half = rating - full >= 0.5
	const span = el("span", "stars")
	span.setAttribute("aria-label", `${rating} out of 5`)
	span.append("★".repeat(full))
	if (half) span.append(el("i", "half", "★"))
	if (5 - full - (half ? 1 : 0) > 0) span.append(el("s", "", "★".repeat(5 - full - (half ? 1 : 0))))
	return span
}
const faceColor = (name: string) =>
	friendColors[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % friendColors.length]
function face(name: string) {
	const span = el("span", "face", name.slice(0, 1).toUpperCase())
	span.style.background = faceColor(name)
	span.title = name
	return span
}
const providerService = (name: string) => streamingServices.find((service) => SERVICE_PROVIDER[service].test(name))
const providerColor = (name: string) => {
	const service = providerService(name)
	return service ? serviceColors[SERVICES[service].statsKey] : color.surfaceRaised
}

function head() {
	const bar = el("div", "head")
	const logo = el("span", "logo")
	logo.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="${palette.tangerine}"/><circle cx="24" cy="32" r="14" fill="${palette.couch}"/><circle cx="40" cy="32" r="14" fill="${palette.popcorn}"/><path d="M32 20.51 A14 14 0 0 1 32 43.49 A14 14 0 0 1 32 20.51 Z" fill="${palette.tangerine}"/></svg>`
	const close = el("button", "close", "×")
	close.setAttribute("aria-label", "Close")
	bar.append(logo, el("span", "brand", "streamBuddy"), close)
	return bar
}

// The popover's content, without the hover/positioning shell, so it can be rendered again when availability arrives.
export function renderInspector(
	data: MovieInfo,
	personal: PersonalStatus,
	service: StreamingService,
	showFriends: boolean,
	availability: Availability | null | undefined,
	showWhere: boolean,
): HTMLElement {
	const root = el("div", "sb-inspector")
	root.setAttribute("role", "dialog")
	root.setAttribute("aria-label", `${data.title} details`)

	root.append(head())

	root.append(el("h2", "title", data.title))
	const year = data.release_date?.slice(0, 4)
	const type = data.media_type === "tv" ? "Series" : data.media_type === "movie" ? "Film" : ""
	root.append(el("div", "meta", [year, type].filter(Boolean).join(" · ")))

	const rating = data.source === "tmdb" ? data.score : data.rating
	const votes = (data.source === "tmdb" ? data.vote_count : data.rating_count) || 0
	const score = el("div", "score")
	const big = el("span", "big", rating ? rating.toFixed(1) : "—")
	if (rating)
		big.style.background =
			votes < 50 && data.source === "tmdb" ? color.badgeUnrated : getScoreColor(data.source, rating)
	const copy = el("div", "copy")
	copy.append(el("b", "", RATING_SOURCES[data.source].scoreLabel))
	copy.append(
		el(
			"span",
			"",
			rating ? `${rating.toFixed(1)} / ${RATING_SOURCES[data.source].max} · ${count(votes)} ratings` : "No rating yet",
		),
	)
	score.append(big, copy)
	if (showFriends && data.friends_rating) {
		const friends = el("div", "friends")
		const faces = el("span", "faces")
		for (const friend of (data.friends ?? []).slice(0, 3)) faces.append(face(friend.name))
		friends.append(faces, el("b", "", data.friends_rating.toFixed(1)))
		score.append(friends)
	}
	root.append(score)

	if (personal.watched !== undefined || personal.watchlist) {
		const mine = el("div", "personal")
		if (personal.watched !== undefined) {
			mine.append(el("span", "dot"))
			mine.append(personal.watched ? `You rated it ${personal.watched.toFixed(1)}` : "In your diary")
			if (personal.watched) mine.append(stars(personal.watched))
		} else {
			mine.append(el("span", "dot watch"), "On your watchlist")
		}
		root.append(mine)
	}

	if (showFriends && data.friends_rating) {
		const label = el("div", "label")
		label.append(el("span", "", "Your friends"))
		const slug = getLetterboxdSlug(data.rating_url)
		const username = letterboxdUsername()
		if (slug && username) {
			const link = el("a", "see-all", `See all ${data.friends_count ?? data.friends?.length ?? 0} →`)
			link.href = `https://letterboxd.com/${username}/friends/film/${slug}/`
			link.target = "_blank"
			link.rel = "noopener noreferrer"
			label.append(link)
		}
		root.append(label)
		for (const friend of (data.friends ?? []).slice(0, 3)) {
			const row = el("div", "friend")
			row.append(face(friend.name), el("span", "name", friend.name), stars(friend.rating))
			root.append(row)
		}
	}

	root.append(el("div", "rule"))
	const where = el("button", "label where-toggle")
	where.type = "button"
	where.setAttribute("aria-expanded", String(showWhere))
	where.append(el("span", "", `Where to watch in ${region()}`))
	where.insertAdjacentHTML(
		"beforeend",
		`<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	)
	root.append(where)
	if (showWhere) {
		const providers = el("div", "providers")
		if (availability === undefined) providers.append(el("div", "providers-state", "Checking availability…"))
		else if (availability === null)
			providers.append(el("div", "providers-state", "Couldn’t check where else it’s streaming."))
		else {
			const serviceName = SERVICES[service].name
			const here = el("div", "provider")
			const chip = el("span", "pchip", serviceName.slice(0, 1))
			chip.style.background = serviceColors[SERVICES[service].statsKey]
			here.append(chip, el("span", "name", serviceName), el("span", "here", "Watching here"))
			providers.append(here)
			const others = availability.rows.filter((row) => !SERVICE_PROVIDER[service].test(row.name))
			for (const row of others) {
				// a search on that service, else TMDb's page with a link to every service
				const provider = providerService(row.name)
				const url = (provider && searchOn(provider, data.title)) || availability.link
				const item = url
					? Object.assign(el("a", "provider"), { href: url, target: "_blank", rel: "noopener noreferrer" })
					: el("div", "provider")
				const mark = el("span", "pchip", row.name.slice(0, 1))
				mark.style.background = providerColor(row.name)
				const right = el("span", `right${row.kind === "flatrate" ? " included" : ""}`, KIND_LABEL[row.kind])
				item.append(mark, el("span", "name", row.name), right)
				providers.append(item)
			}
			if (!others.length)
				providers.append(el("div", "providers-state", "Not listed on another service in your region."))
		}
		root.append(providers)
		if (availability) {
			const attrib = el("div", "attrib")
			attrib.append("Availability by JustWatch")
			root.append(attrib)
		}
	}

	const actions = el("div", "actions")
	const onSource = ["https://letterboxd.com/film/", "https://www.imdb.com/title/"].some((page) =>
		data.rating_url?.startsWith(page),
	)
	const filmUrl = onSource
		? data.rating_url
		: data.media_type && data.id
			? `https://www.themoviedb.org/${data.media_type}/${data.id}`
			: ""
	if (filmUrl) {
		const open = el("a", "btn primary", onSource ? `Open on ${RATING_SOURCES[data.source].name}` : "Open on TMDb")
		open.href = filmUrl
		open.target = "_blank"
		open.rel = "noopener noreferrer"
		actions.append(open)
	}
	const fix = el("button", "btn secondary fix", "Not this title?")
	fix.type = "button"
	actions.append(fix)
	root.append(actions)
	return root
}

export type FixResult = {
	id: number
	media_type: "movie" | "tv"
	title: string
	year?: string
}
// TMDb ids are per media type: film 1399 and series 1399 are different titles
export const resultKey = (result: { id?: number; media_type?: string }) => `${result.media_type}/${result.id}`
export type FixState = {
	query: string
	results: FixResult[]
	selected?: string
	current: string
	searching: boolean
	error: string
}
export type FixActions = {
	search: (query: string) => void
	pick: (key: string) => void
	apply: () => void
	cancel: () => void
}

// The correction view: search TMDb, pick the right title, save it for this card title.
export function renderFix(cardTitle: string, state: FixState, actions: FixActions): HTMLElement {
	const root = el("div", "sb-inspector")
	root.setAttribute("role", "dialog")
	root.setAttribute("aria-label", "Fix the title match")
	root.append(head())
	root.append(el("h2", "title", "Which title is this?"))
	root.append(
		el("p", "note", `The card says “${cardTitle}”. Search TMDb; the fix applies wherever that title appears.`),
	)
	const form = el("form", "search")
	const input = document.createElement("input")
	input.type = "search"
	input.value = state.query
	input.placeholder = "Search TMDb"
	input.setAttribute("aria-label", "Search TMDb")
	const submit = el("button", "btn secondary", "Search")
	submit.type = "submit"
	form.append(input, submit)
	form.addEventListener("submit", (event) => {
		event.preventDefault()
		actions.search(input.value)
	})
	root.append(form)

	const results = el("div", "results")
	if (state.searching) results.append(el("div", "providers-state", "Searching…"))
	else if (state.error) results.append(el("div", "providers-state", state.error))
	else if (!state.results.length)
		results.append(el("div", "providers-state", "No matches yet. Search by the title as it appears on the card."))
	else
		for (const result of state.results) {
			const key = resultKey(result)
			const selected = state.selected === key
			const row = el("button", `result${selected ? " on" : ""}`)
			row.type = "button"
			row.setAttribute("aria-label", `${result.title}${result.year ? ` (${result.year})` : ""}`)
			row.setAttribute("aria-pressed", String(selected))
			const mini = el("span", "mini", result.title.slice(0, 1).toUpperCase())
			const copy = el("span", "rt")
			copy.append(el("b", "", result.title))
			copy.append(
				el("span", "", [result.year, result.media_type === "tv" ? "Series" : "Film"].filter(Boolean).join(" · ")),
			)
			const pick = el("span", "pick", key === state.current ? "Current" : selected ? "Selected" : "Choose")
			row.append(mini, copy, pick)
			row.addEventListener("click", () => actions.pick(key))
			results.append(row)
		}
	root.append(results)
	root.append(el("p", "foot", "Stored on this device. The override applies wherever this card title appears."))

	const buttons = el("div", "actions")
	const cancel = el("button", "btn secondary", "Cancel")
	cancel.type = "button"
	cancel.addEventListener("click", actions.cancel)
	const apply = el("button", "btn primary", "Use this title")
	apply.type = "button"
	apply.disabled = !state.selected || state.selected === state.current
	apply.addEventListener("click", actions.apply)
	buttons.append(cancel, apply)
	root.append(buttons)
	return root
}

const STYLE = `
* { box-sizing: border-box; }
.sb-inspector { width: 100%; max-height: min(640px, calc(100vh - 24px)); overflow-y: auto; padding: 16px; border: 1px solid var(--sb-line-solid); border-radius: 22px; background: var(--sb-bg); box-shadow: var(--sb-shadow-review); color: var(--sb-text); font: 500 13px/1.35 var(--sb-font-page); scrollbar-width: thin; scrollbar-color: var(--sb-scrollbar) transparent; }
.sb-inspector .head { display: flex; align-items: center; gap: 7px; color: var(--sb-text-muted); font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
.sb-inspector .logo { display: flex; flex: none; width: 16px; height: 16px; }
.sb-inspector .logo svg { width: 100%; height: 100%; }
.sb-inspector .close { all: unset; margin-left: auto; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--sb-text-muted); font-size: 20px; cursor: pointer; }
.sb-inspector .close:hover { background: var(--sb-well); color: var(--sb-text); }
.sb-inspector .title { margin: 10px 0 2px; font-size: 21px; font-weight: 800; line-height: 1.08; letter-spacing: -.025em; }
.sb-inspector .meta { color: var(--sb-text-muted); font-size: 12px; }
.sb-inspector .score { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 10px; border-radius: 14px; background: var(--sb-well); }
.sb-inspector .big { padding: 6px 10px; border-radius: 9px; background: var(--sb-badge-unrated); color: var(--sb-text-on-accent); font-size: 20px; font-weight: 800; letter-spacing: -.03em; }
.sb-inspector .copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sb-inspector .copy b { font-size: 13px; font-weight: 700; }
.sb-inspector .copy span { color: var(--sb-text-muted); font-size: 11px; }
.sb-inspector .friends { margin-left: auto; display: flex; align-items: center; gap: 7px; }
.sb-inspector .friends b { color: var(--sb-accent); font-size: 15px; font-weight: 800; }
.sb-inspector .faces { display: inline-flex; }
.sb-inspector .face { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid var(--sb-bg); color: var(--sb-text-on-accent); font-size: 10px; font-weight: 800; }
.sb-inspector .faces .face + .face { margin-left: -8px; }
.sb-inspector .personal { display: flex; align-items: center; gap: 7px; margin-top: 9px; color: var(--sb-text-soft); font-size: 12px; }
.sb-inspector .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sb-info); flex: none; }
.sb-inspector .dot.watch { background: var(--sb-badge-watchlist); }
.sb-inspector .personal .stars { margin-left: auto; }
.sb-inspector .label { display: flex; align-items: center; margin: 14px 0 7px; color: var(--sb-text-muted); font-size: 10px; font-weight: 600; letter-spacing: .13em; text-transform: uppercase; }
.sb-inspector .where-toggle { width: 100%; margin-bottom: 0; padding: 0; border: 0; background: none; font-family: inherit; cursor: pointer; }
.sb-inspector .where-toggle:hover { color: var(--sb-text); }
.sb-inspector .where-toggle .chevron { width: 14px; height: 14px; margin-left: auto; transition: transform .2s; }
.sb-inspector .where-toggle[aria-expanded="true"] { margin-bottom: 7px; }
.sb-inspector .where-toggle[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.sb-inspector .see-all { margin-left: auto; color: var(--sb-text-muted); font-size: 11px; font-weight: 500; letter-spacing: 0; text-transform: none; text-decoration: none; }
.sb-inspector .see-all:hover { color: var(--sb-text); }
.sb-inspector .friend { display: flex; align-items: center; gap: 9px; padding: 5px 0; font-size: 13px; }
.sb-inspector .friend .face { width: 26px; height: 26px; border: 0; font-size: 11px; }
.sb-inspector .friend .name { color: var(--sb-text); }
.sb-inspector .stars { margin-left: auto; color: var(--sb-accent); letter-spacing: .08em; font-size: 12px; white-space: nowrap; }
.sb-inspector .stars s { color: var(--sb-star-empty); text-decoration: none; }
.sb-inspector .half { font-style: normal; color: transparent; background: linear-gradient(90deg, var(--sb-accent) 50%, var(--sb-star-empty) 50%); -webkit-background-clip: text; background-clip: text; }
.sb-inspector .rule { height: 1px; margin: 12px 0; background: var(--sb-line-solid); }
.sb-inspector .providers { border: 1px solid var(--sb-hairline); border-radius: var(--sb-radius-xl); overflow: hidden; }
.sb-inspector .provider { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-top: 1px solid var(--sb-hairline); font-size: 12px; }
.sb-inspector .provider:first-child { border-top: 0; }
.sb-inspector a.provider { text-decoration: none; }
.sb-inspector a.provider:hover { background: var(--sb-hover); }
.sb-inspector a.provider .right::after { content: " ↗"; }
.sb-inspector .pchip { width: 22px; height: 22px; border-radius: var(--sb-radius-sm); display: flex; align-items: center; justify-content: center; color: var(--sb-text); font-size: 10px; font-weight: 800; flex: none; }
.sb-inspector .provider .name { color: var(--sb-text); }
.sb-inspector .provider .right { margin-left: auto; color: var(--sb-text-muted); font-size: 11px; }
.sb-inspector .provider .right.included { color: var(--sb-up); }
.sb-inspector .provider .here { margin-left: auto; color: var(--sb-accent); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.sb-inspector .providers-state { padding: 9px 10px; color: var(--sb-text-muted); font-size: 11px; }
.sb-inspector .attrib { margin: 6px 0 0; color: var(--sb-text-muted); font-size: 9px; }
.sb-inspector .actions { display: flex; gap: 8px; margin-top: 13px; }
.sb-inspector .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 0 13px; border-radius: 11px; font-size: 12px; font-weight: 700; text-decoration: none; }
.sb-inspector .btn.primary { flex: 1; background: var(--sb-accent); color: var(--sb-text-on-accent); }
.sb-inspector .btn.primary:hover { background: var(--sb-accent); filter: brightness(1.06); }
.sb-inspector .note { margin: 8px 0 10px; color: var(--sb-text-muted); font-size: 12px; line-height: 1.45; }
.sb-inspector .search { display: flex; gap: 6px; }
.sb-inspector .search input { flex: 1; min-width: 0; height: 36px; padding: 0 10px; border: 1px solid var(--sb-line-field); border-radius: 9px; background: var(--sb-field); color: var(--sb-text); font: inherit; }
.sb-inspector .search .btn { min-height: 36px; padding: 0 12px; }
.sb-inspector .results { margin-top: 2px; }
.sb-inspector .result { display: flex; width: 100%; align-items: center; gap: 9px; padding: 8px; margin-top: 6px; border: 1px solid transparent; border-radius: var(--sb-radius-lg); background: transparent; color: var(--sb-text); text-align: left; cursor: pointer; }
.sb-inspector .result:hover { background: var(--sb-surface); }
.sb-inspector .result.on { border-color: var(--sb-accent); background: var(--sb-accent-wash); }
.sb-inspector .result .mini { display: flex; align-items: center; justify-content: center; width: 28px; height: 40px; border-radius: var(--sb-radius-xs); background: var(--sb-surface-raised); color: var(--sb-text-muted); font-size: 13px; font-weight: 700; flex: none; }
.sb-inspector .result .rt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sb-inspector .result .rt b { font-size: 13px; font-weight: 600; }
.sb-inspector .result .rt span { color: var(--sb-text-muted); font-size: 11px; }
.sb-inspector .result .pick { margin-left: auto; color: var(--sb-accent); font-size: 11px; font-weight: 700; }
.sb-inspector .foot { margin: 10px 0 0; color: var(--sb-text-muted); font-size: 10px; line-height: 1.4; }
.sb-inspector .btn.secondary { border: 1px solid var(--sb-line-solid); background: transparent; color: var(--sb-text); font-weight: 500; }
.sb-inspector .btn:disabled { opacity: .45; cursor: default; }
@media (prefers-reduced-motion: reduce) { .sb-inspector * { animation: none !important; transition: none !important; } }
`

type FixSearchResult = {
	id?: number
	media_type?: string
	title?: string
	name?: string
	original_title?: string
	original_name?: string
	release_date?: string
	first_air_date?: string
	vote_count?: number
}

const near = (element: Element, { clientX: x, clientY: y }: PointerEvent, pad: number) => {
	const box = element.getBoundingClientRect()
	return x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad
}

const HOVER_OPEN_MS = 450
const HOVER_CLOSE_MS = 220
// tabbing from one badge to the next shouldn't leave the first one's inspector open
let closeOpenInspector: (() => void) | null = null

// Wire the hover/focus behaviour onto one badge. Every badge gets its own listeners; only one popover is ever open.
export function attachInspector(
	badge: HTMLElement,
	data: MovieInfo,
	personal: PersonalStatus,
	service: StreamingService,
	showFriends: boolean,
	cardTitle: string,
) {
	let host: HTMLElement | null = null
	let shadow: ShadowRoot | null = null
	let openTimer: ReturnType<typeof setTimeout> | undefined
	let closeTimer: ReturnType<typeof setTimeout> | undefined
	let availability: Availability | null | undefined
	let started = false
	let cleanup: (() => void)[] = []
	let mode: "detail" | "fix" = "detail"
	let fixQuery = cardTitle
	let fixResults: FixResult[] = []
	let fixSelected: string | undefined
	// a newer search, or closing, makes an older search's answer stale
	let searchRun = 0
	let fixSearching = false
	let fixError = ""
	let pointerType = ""
	let refocusing = false

	const position = () => {
		if (!host) return
		const rect = badge.getBoundingClientRect()
		const box = host.getBoundingClientRect()
		const width = Math.min(360, innerWidth - 16)
		host.style.width = `${width}px`
		let left = rect.right - width
		left = Math.max(8, Math.min(left, innerWidth - width - 8))
		let top = rect.bottom + 8
		if (top + box.height > innerHeight - 8 && rect.top - box.height - 8 > 8) top = rect.top - box.height - 8
		// A panel taller than the space below and above still stays on screen; the CSS caps it at the viewport.
		top = Math.max(8, Math.min(top, innerHeight - box.height - 8))
		host.style.left = `${Math.round(left)}px`
		host.style.top = `${Math.round(top)}px`
	}
	const runSearch = async (query: string) => {
		const wanted = query.trim()
		if (!wanted) return
		const run = ++searchRun
		fixQuery = wanted
		fixResults = []
		fixSelected = undefined
		fixSearching = true
		fixError = ""
		paint()
		let results: FixResult[] = []
		let error = ""
		try {
			const response = (await sendMessage(
				"fetch",
				{
					url: `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(wanted)}&include_adult=false&language=${document.documentElement.lang || navigator.language || "en-US"}&page=1`,
					type: "tmdb",
				},
				"background",
			)) as { results?: FixSearchResult[]; error?: string } | null
			if (!response || response.error) throw new Error(response?.error ?? "unavailable")
			results = (response.results ?? [])
				.flatMap((item): FixResult[] => {
					const type = item.media_type
					const title = item.title || item.name || item.original_title || item.original_name
					if ((type !== "movie" && type !== "tv") || !title || typeof item.id !== "number") return []
					// a title nobody has rated would leave the card with no badge, and so no way back to this view
					if (!item.vote_count) return []
					const year = (item.release_date || item.first_air_date || "").slice(0, 4) || undefined
					return [{ id: item.id, media_type: type, title, year }]
				})
				.slice(0, 5)
		} catch {
			error = "TMDb could not be searched. Try again."
		}
		if (run !== searchRun) return
		fixResults = results
		fixError = error
		fixSearching = false
		if (host) paint()
	}
	const applyFix = async () => {
		const picked = fixResults.find((result) => resultKey(result) === fixSelected)
		if (!picked) return
		try {
			await saveOverride(cardTitle, {
				id: picked.id,
				media_type: picked.media_type,
				title: picked.title,
				year: picked.year,
			})
			deleteCached(cardTitle)
			close()
		} catch {
			fixError = "The fix could not be saved."
			paint()
		}
	}
	// asked for only once "Where to watch" is open
	const loadAvailability = () => {
		if (started) return
		started = true
		void loadProviders(data).then((next) => {
			availability = next
			if (host) {
				paint()
				requestAnimationFrame(position)
			}
		})
	}
	const paint = () => {
		if (!shadow) return
		const toggleFocused = !!shadow.activeElement?.classList.contains("where-toggle")
		shadow.querySelector(".sb-inspector")?.remove()
		const content =
			mode === "fix"
				? renderFix(
						cardTitle,
						{
							query: fixQuery,
							results: fixResults,
							selected: fixSelected,
							current: resultKey(data),
							searching: fixSearching,
							error: fixError,
						},
						{
							search: (query) => void runSearch(query),
							pick: (key) => {
								fixSelected = key
								paint()
							},
							apply: () => void applyFix(),
							cancel: () => {
								mode = "detail"
								paint()
							},
						},
					)
				: renderInspector(data, personal, service, showFriends, availability, whereOpen)
		content.querySelector<HTMLButtonElement>(".close")?.addEventListener("click", (event) => {
			event.stopPropagation()
			close()
		})
		if (mode === "detail") {
			const toggle = content.querySelector<HTMLButtonElement>(".where-toggle")
			toggle?.addEventListener("click", (event) => {
				whereOpen = !whereOpen
				if (whereOpen) loadAvailability()
				paint()
				// focus left by a mouse click would keep the card from closing when the pointer leaves
				if (event.detail) shadow?.querySelector<HTMLButtonElement>(".where-toggle")?.blur()
			})
		}
		if (mode === "detail")
			content.querySelector<HTMLButtonElement>(".fix")?.addEventListener("click", () => {
				mode = "fix"
				fixQuery = cardTitle
				fixResults = []
				fixSelected = undefined
				fixError = ""
				paint()
				void runSearch(cardTitle)
			})
		shadow.append(content)
		if (toggleFocused) content.querySelector<HTMLButtonElement>(".where-toggle")?.focus()
		requestAnimationFrame(position)
	}
	const close = () => {
		clearTimeout(openTimer)
		clearTimeout(closeTimer)
		closeTimer = undefined
		cleanup.forEach((fn) => fn())
		cleanup = []
		host?.remove()
		host = null
		shadow = null
		mode = "detail"
		fixQuery = cardTitle
		fixResults = []
		fixSelected = undefined
		fixSearching = false
		fixError = ""
		searchRun++
		if (closeOpenInspector === close) closeOpenInspector = null
		const title = badge.dataset.inspectorTitle
		if (title) {
			badge.setAttribute("title", title)
			delete badge.dataset.inspectorTitle
		}
	}
	const open = () => {
		if (host || !badge.isConnected) return
		clearTimeout(openTimer)
		closeOpenInspector?.()
		closeOpenInspector = close
		installPageFont()
		host = document.createElement("div")
		host.setAttribute("data-sb-inspector", "")
		Object.assign(host.style, {
			position: "fixed",
			width: "360px",
			zIndex: "2147483400",
			pointerEvents: "auto",
		})
		shadow = host.attachShadow({ mode: "open" })
		const style = document.createElement("style")
		style.textContent = `:host { all: initial; ${cssDeclarations()} } ${STYLE}`
		shadow.append(style)
		paint()
		document.body.append(host)
		const title = badge.getAttribute("title")
		if (title) {
			badge.dataset.inspectorTitle = title
			badge.removeAttribute("title")
		}
		requestAnimationFrame(position)

		// Closes by distance, not pointerleave: Netflix and Prime grow a hover card over the one under the pointer, which
		// would count as leaving the badge while the pointer hasn't moved.
		const away = (event: PointerEvent) => {
			if (!host) return
			// typing a search in the fix view keeps it open wherever the pointer drifts
			if (near(badge, event, 24) || near(host, event, 8) || host.matches(":focus-within")) {
				clearTimeout(closeTimer)
				closeTimer = undefined
			} else closeTimer ??= setTimeout(close, HOVER_CLOSE_MS)
		}
		const outside = (event: PointerEvent) => {
			if (!host) return
			const path = event.composedPath()
			if (path.includes(host) || path.includes(badge)) return
			close()
		}
		const escape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			const hadFocus = host?.matches(":focus-within")
			close()
			if (!hadFocus) return
			refocusing = true
			badge.focus()
			refocusing = false
		}
		const onScroll = () => close()
		const onResize = () => position()
		const observer = new MutationObserver(() => {
			if (!badge.isConnected) close()
		})
		document.addEventListener("pointermove", away, true)
		document.addEventListener("pointerdown", outside, true)
		document.addEventListener("keydown", escape)
		globalThis.addEventListener("scroll", onScroll, true)
		globalThis.addEventListener("resize", onResize)
		observer.observe(document.body, { childList: true, subtree: true })
		cleanup = [
			() => document.removeEventListener("pointermove", away, true),
			() => document.removeEventListener("pointerdown", outside, true),
			() => document.removeEventListener("keydown", escape),
			() => globalThis.removeEventListener("scroll", onScroll, true),
			() => globalThis.removeEventListener("resize", onResize),
			() => observer.disconnect(),
		]

		if (whereOpen) loadAvailability()
	}

	badge.addEventListener("pointerenter", () => {
		clearTimeout(openTimer)
		openTimer = setTimeout(open, HOVER_OPEN_MS)
	})
	badge.addEventListener("pointerleave", () => clearTimeout(openTimer))
	badge.addEventListener("focus", () => {
		if (!refocusing) open()
	})
	// the inspector sits at the end of the page, so Tab from the badge goes into it rather than past it
	badge.addEventListener("keydown", (event) => {
		const first = shadow?.querySelector<HTMLElement>("button, a[href]")
		if (event.key !== "Tab" || event.shiftKey || !first) return
		event.preventDefault()
		first.focus()
	})
	badge.addEventListener("pointerdown", (event) => (pointerType = event.pointerType))
	badge.addEventListener("click", (event) => {
		// On touch there is no hover: the first tap opens the inspector instead of a new Letterboxd tab.
		if (pointerType !== "touch") return
		event.preventDefault()
		open()
	})
}

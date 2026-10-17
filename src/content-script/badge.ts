// The rating badge on a card: drawn from a looked-up rating and the badge settings, then fitted into a corner of
// the card's artwork
import { color, ease, font, friendColors as FRIEND_DOT_COLORS, shadow } from "@/design/tokens"
import { applyGlass, installPageFeatureStyle } from "@/utils/page-feature-styles"
import { getScoreBand, getScoreColor } from "@/utils/ratings"
import { normalizeRowScore } from "@/utils/row-presentation"
import type { MovieInfo } from "./cache"
import type { PersonalStatus } from "./profile"
import type { BadgeHost, RatingsSite } from "./sites/types"

// TMDb is only the fallback: colour it on the IMDb scale (both are out of 10), grey when too few people voted
export const TMDB_LOW_RATING = 5.5
function getTmdbColor(rating: number, lowVoteCount: boolean) {
	return !rating || lowVoteCount ? color.badgeUnrated : getScoreColor("imdb", rating)
}
// Letterboxd and IMDb dim by colour band (the cut-off is picked in the popup); TMDb keeps the old threshold
export function isDimmed(data: MovieInfo, lowVoteCount: boolean, dimBelowBand: number) {
	if (data.source !== "tmdb" && data.rating) return getScoreBand(data.source, data.rating) < dimBelowBand
	return !lowVoteCount && (!data.score || data.score <= TMDB_LOW_RATING)
}
function getTMDBUrl(id: string | number, media_type: string) {
	return `https://www.themoviedb.org/${media_type}/${id}`
}
// on a 0-10 scale so the dim-low-ratings thresholds work for every source
export function getNormalizedScore(data: MovieInfo) {
	if (data.source !== "tmdb" && data.rating) return normalizeRowScore(data.source, data.rating)
	return data.score
}
export function getRatingVoteCount(data: MovieInfo) {
	return (data.source === "tmdb" ? data.vote_count : data.rating_count) || 0
}
// A popcorn chip: the score in a pill coloured by how it ranks among what's streaming, then, smaller, friends'
// Letterboxd average and your own status (your rating, seen, or on your watchlist), labelled or as dots per the
// friendsStyle setting. The exact score and scale are in the tooltip; colour adds context rather than carrying the meaning.
// colours inside the badge go through variables so the Liquid Glass look can switch them to light-on-glass
const BADGE_LABEL = `var(--sb-badge-label, ${color.badgeLabel})`
const BADGE_TEXT = `var(--sb-badge-ink, ${color.badgeInk})`
const BADGE_WATCHLIST = `var(--sb-badge-watchlist, ${color.badgeWatchlist})`
const BADGE_CHIP = `var(--sb-badge-bg, ${color.badgeBg})`
// the small column beside the score: friends/you lines, or the IMDb/TMDb source name
const LABEL_COLUMN_STYLE = { padding: "0 0.5em 0 0.45em", fontSize: "max(10px, 0.72em)", fontWeight: "800" }
function addBadgeSegment(div: HTMLElement, text: string, color = BADGE_TEXT) {
	const segment = document.createElement("span")
	Object.assign(segment.style, {
		display: "inline-flex",
		alignItems: "center",
		gap: "0.3em",
		padding: "0 0.5em 0 0.2em",
		fontSize: "max(11px, 0.8em)",
		fontWeight: "700",
		color,
		whiteSpace: "nowrap",
	})
	segment.append(text)
	div.appendChild(segment)
	return segment
}
// a little stack of faces: one per friend, coloured by name so the same friend keeps the same colour
function friendDots(colors: string[]) {
	const dots = document.createElement("span")
	dots.style.display = "inline-flex"
	colors.forEach((color, i) => {
		const dot = document.createElement("i")
		Object.assign(dot.style, {
			display: "block",
			width: "1.05em",
			height: "1.05em",
			boxSizing: "border-box",
			marginLeft: i ? "-0.35em" : "0",
			borderRadius: "50%",
			border: `0.15em solid ${BADGE_CHIP}`,
			background: color,
		})
		dots.appendChild(dot)
	})
	return dots
}
function friendColors(friends: { name: string }[], count: number) {
	const names = friends.length ? friends.map((friend) => friend.name) : Array.from({ length: count }, (_, i) => `${i}`)
	return names.slice(0, 3).map((name) => {
		const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
		return FRIEND_DOT_COLORS[hash % FRIEND_DOT_COLORS.length]
	})
}
function friendsIcon(friends: { name: string }[], count: number, style: FriendsStyle) {
	if (style === "trio") return friendDots(FRIEND_DOT_COLORS.slice(0, 3))
	return friendDots(friendColors(friends, count))
}
// The default layout: a small column beside the score with a labelled line each for friends and you,
// so what each number means is written on the badge rather than left to the tooltip.
function addLabelLine(
	div: HTMLElement,
	column: HTMLElement | undefined,
	dot: string,
	label: string,
	value: string,
	color = BADGE_TEXT,
) {
	if (!column) {
		column = document.createElement("span")
		Object.assign(column.style, {
			...LABEL_COLUMN_STYLE,
			display: "inline-flex",
			flexDirection: "column",
			gap: "0.2em",
			lineHeight: "1",
			whiteSpace: "nowrap",
		})
		div.appendChild(column)
	}
	const line = document.createElement("span")
	Object.assign(line.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5em" })
	const name = document.createElement("span")
	Object.assign(name.style, {
		display: "inline-flex",
		alignItems: "center",
		gap: "0.3em",
		color: BADGE_LABEL,
		fontWeight: "700",
	})
	const swatch = document.createElement("i")
	Object.assign(swatch.style, {
		display: "block",
		width: "0.6em",
		height: "0.6em",
		borderRadius: "50%",
		background: dot,
	})
	name.append(swatch, label)
	const score = document.createElement("span")
	score.style.color = color
	score.append(value)
	line.append(name, score)
	column.appendChild(line)
	return column
}
const formatCount = (count = 0) =>
	count >= 1e6 ? `${(count / 1e6).toFixed(1)}M` : count >= 1e3 ? `${Math.round(count / 1e3)}K` : String(count)
function fillBadge(div: HTMLElement, data: MovieInfo, general: settingsType["General"], personal: PersonalStatus) {
	const votes = getRatingVoteCount(data)
	const tmdbColor = getTmdbColor(getNormalizedScore(data), votes < 50)
	const main = document.createElement("span")
	Object.assign(main.style, {
		padding: "0.28em 0.6em",
		borderRadius: "var(--sb-pill-r, 999px)",
		fontSize: "1.15em",
		fontWeight: "800",
		letterSpacing: "-0.02em",
		whiteSpace: "nowrap",
		// dark on the band colour in both badge looks
		color: color.badgeInk,
		textShadow: "none",
	})
	const tooltip: string[] = []
	let value: string
	if (data.source === "letterboxd") {
		value = data.rating?.toFixed(1) ?? ""
		main.style.background = getScoreColor("letterboxd", data.rating ?? 0)
		tooltip.push(`Letterboxd ${data.rating?.toFixed(2)}/5 · ${formatCount(data.rating_count)} ratings`)
	} else if (data.source === "imdb") {
		value = data.rating?.toFixed(1) ?? ""
		main.style.background = getScoreColor("imdb", data.rating ?? 0)
		tooltip.push(`IMDb ${data.rating?.toFixed(1)}/10 · ${formatCount(data.rating_count)} ratings`)
	} else {
		value = data.score?.toFixed(1) ?? ""
		main.style.background = tmdbColor
		tooltip.push(`TMDb ${data.score?.toFixed(1)}/10 (no Letterboxd or IMDb rating)`)
	}
	main.append(value)
	div.appendChild(main)
	// Letterboxd's 0-5 is the default; a 0-10 score from IMDb or TMDb says where it's from in the label column
	if (data.source !== "letterboxd") {
		const source = document.createElement("span")
		Object.assign(source.style, { ...LABEL_COLUMN_STYLE, color: BADGE_LABEL })
		source.append(data.source === "imdb" ? "IMDb" : "TMDb")
		div.appendChild(source)
	}
	const labelled = general.friendsStyle === "labels"
	let column: HTMLElement | undefined
	if (data.source === "letterboxd" && data.friends_rating && general.friendsRatings) {
		if (labelled) column = addLabelLine(div, column, color.accent, "friends", data.friends_rating.toFixed(1))
		else {
			const segment = addBadgeSegment(div, data.friends_rating.toFixed(1))
			segment.prepend(friendsIcon(data.friends ?? [], data.friends_count ?? 1, general.friendsStyle))
		}
		const names = (data.friends ?? []).map((friend) => `${friend.name} ${friend.rating.toFixed(1)}`).join(", ")
		tooltip.push(
			`Friends ${data.friends_rating.toFixed(1)} from ${data.friends_count}${names ? `: ${names}` : ""}${(data.friends_count ?? 0) > (data.friends?.length ?? 0) ? "…" : ""}`,
		)
	}
	if (personal.watched !== undefined) {
		if (labelled) addLabelLine(div, column, color.info, "you", personal.watched ? personal.watched.toFixed(1) : "seen")
		else addBadgeSegment(div, personal.watched ? `✓ you ${personal.watched.toFixed(1)}` : "✓ seen")
		tooltip.push(personal.watched ? `You rated it ${personal.watched.toFixed(1)}` : "You've logged it")
	} else if (personal.watchlist) {
		if (labelled) addLabelLine(div, column, color.info, "you", "watchlist", BADGE_WATCHLIST)
		else addBadgeSegment(div, "watchlist", BADGE_WATCHLIST)
		tooltip.push("On your watchlist")
	}
	div.title = tooltip.join("\n")
	div.setAttribute("aria-label", tooltip.join(". "))
}

// The badge sits in a corner of the card's artwork: the same gap from both edges of that corner, and its corners
// follow the artwork's (the artwork's radius less the gap, and the score pill inside the same again, so the curves
// share a centre). The artwork often sits inset in the element the badge is attached to (Netflix pads its slots,
// Max its tiles), so the gap is measured from the artwork itself rather than from the badge's container.
const BADGE_INSET_PX = 3
const BADGE_PAD_PX = 3
type BadgeCorner = "top" | "bottom"
const badgeFits = new WeakMap<HTMLElement, { host: HTMLElement; corner: BadgeCorner; raise: number }>()
// the artwork: the biggest rounded box in the card (else its biggest image), skipping our own badge and overlays.
// The container itself is only a fallback, since its box includes the gutter around the artwork.
function findArtwork(host: HTMLElement) {
	const rounded: { el: HTMLElement; rect: DOMRect }[] = []
	let image: { el: HTMLElement; rect: DOMRect } | undefined
	const area = (rect: DOMRect) => rect.width * rect.height
	for (const el of Array.from(host.querySelectorAll<HTMLElement>("img, picture, div, span")).slice(0, 80)) {
		if (el.closest(".sb-card-rating")) continue
		const rect = el.getBoundingClientRect()
		if (!rect.width || !rect.height) continue
		const style = getComputedStyle(el)
		const radius =
			Number.parseFloat(style.borderTopRightRadius) || Number.parseFloat(style.borderBottomRightRadius) || 0
		if (radius > 0 && style.borderTopRightRadius.endsWith("px")) rounded.push({ el, rect })
		if (el.tagName === "IMG" && (!image || area(rect) > area(image.rect))) image = { el, rect }
	}
	// a rounded badge or progress bar is no artwork, so the rounded box has to be about as big as the biggest image,
	// and a focus ring drawn around the image (Max's tile outline) isn't either, so it can't reach outside it
	const inside = (rect: DOMRect, outer: DOMRect) =>
		rect.left >= outer.left - 0.5 &&
		rect.top >= outer.top - 0.5 &&
		rect.right <= outer.right + 0.5 &&
		rect.bottom <= outer.bottom + 0.5
	const artwork = rounded
		.filter(({ rect }) => !image || (area(rect) >= area(image.rect) * 0.8 && inside(rect, image.rect)))
		.sort((a, b) => area(b.rect) - area(a.rect))[0]
	return artwork ?? image ?? { el: host, rect: host.getBoundingClientRect() }
}
function cornerRadius(art: HTMLElement, host: HTMLElement, corner: BadgeCorner) {
	const property = corner === "top" ? "borderTopRightRadius" : "borderBottomRightRadius"
	// the radius can sit on the artwork or on a clipping ancestor of it inside the card
	let radius = 0
	for (let el: HTMLElement | null = art; el; el = el === host ? null : el.parentElement) {
		const value = getComputedStyle(el)[property]
		if (value.endsWith("px")) radius = Math.max(radius, Number.parseFloat(value) || 0)
	}
	return radius
}
// raise: a bottom badge sits that fraction of the artwork's height higher (Prime's channel logo)
export function fitBadgeToCorner(div: HTMLElement, host: HTMLElement, corner: BadgeCorner, raise = 0) {
	badgeFits.set(div, { host, corner, raise })
	watchBadgeResizes()
	const art = findArtwork(host)
	const box = div.offsetParent as HTMLElement | null
	if (art && box) {
		const outer = box.getBoundingClientRect()
		const border = getComputedStyle(box)
		// absolute offsets are measured from the containing block's padding box; clientWidth and clientHeight round
		// to whole pixels, so take its edges from the fractional rect instead
		const px = (value: number) => `${value.toFixed(2)}px`
		const right = outer.right - Number.parseFloat(border.borderRightWidth)
		div.style.right = px(right - art.rect.right + BADGE_INSET_PX)
		if (corner === "top")
			div.style.top = px(art.rect.top - (outer.top + Number.parseFloat(border.borderTopWidth)) + BADGE_INSET_PX)
		else {
			const bottom = outer.bottom - Number.parseFloat(border.borderBottomWidth)
			div.style.bottom = px(bottom - art.rect.bottom + art.rect.height * raise + BADGE_INSET_PX)
		}
	}
	const radius = art ? cornerRadius(art.el, host, corner) : 0
	const badgeRadius = Math.max(radius - BADGE_INSET_PX, 2)
	div.style.borderRadius = `${badgeRadius}px`
	div.style.setProperty("--sb-pill-r", `${Math.max(badgeRadius - BADGE_PAD_PX, 2)}px`)
}
// card sizes follow the window, so re-measure the badges on screen after a resize settles
let badgeResizeTimer: ReturnType<typeof setTimeout> | undefined
let watchingBadgeResizes = false
function watchBadgeResizes() {
	if (watchingBadgeResizes) return
	watchingBadgeResizes = true
	globalThis.addEventListener("resize", () => {
		clearTimeout(badgeResizeTimer)
		badgeResizeTimer = setTimeout(() => {
			for (const div of Array.from(document.querySelectorAll<HTMLElement>(".sb-card-rating"))) {
				const fit = badgeFits.get(div)
				if (fit && div.isConnected) fitBadgeToCorner(div, fit.host, fit.corner, fit.raise)
			}
		}, 200)
	})
}

export type BadgeOptions = {
	general: settingsType["General"]
	personal: PersonalStatus
	position: RatingsSite["badge"]
	// the title as read off the card, for the badge's alt text
	cardTitle: string
}
// the badge for a title that has a rating: a link to it, styled and filled in, not yet on the page
export function renderBadge(data: MovieInfo, { general, personal, position, cardTitle }: BadgeOptions) {
	let div: HTMLElement
	if (data.id) {
		const a = document.createElement("a")
		a.href = data.rating_url ?? getTMDBUrl(data.id, data.media_type)
		a.target = "_blank"
		a.rel = "noopener noreferrer"
		a.addEventListener("click", (event) => event.stopPropagation())
		div = a
	} else div = document.createElement("div")
	installPageFeatureStyle()
	div.id = "rating"
	div.classList.add("sb-card-rating")
	// which streamBuddy build drew this badge (handy for checking that a rebuild was picked up)
	div.dataset.sbBuild = __BUILD_ID__
	// popcorn chip: score pill first, friends and your status beside it; wraps on narrow cards
	Object.assign(div.style, {
		position: "absolute",
		[position.corner]: `${BADGE_INSET_PX}px`,
		right: position.right ?? `${BADGE_INSET_PX}px`,
		maxWidth: `calc(100% - ${2 * BADGE_INSET_PX}px)`,
		boxSizing: "border-box",
		display: "flex",
		flexWrap: "wrap",
		justifyContent: "flex-end",
		alignItems: "center",
		rowGap: "0.2em",
		color: BADGE_TEXT,
		textDecoration: "none",
		background: BADGE_CHIP,
		boxShadow: shadow.sticker,
		borderRadius: "1.1em",
		opacity: "0",
		transform: "translateY(2px)",
		transition: `opacity 160ms ease-out, transform 220ms ${ease.settle}`,
		padding: `${BADGE_PAD_PX}px`,
		fontFamily: font.page,
		fontWeight: "700",
		fontVariantNumeric: "tabular-nums",
		lineHeight: "1",
		zIndex: position.zIndex,
		fontSize: /mobile/i.test(navigator.userAgent) ? "clamp(13px, 4vw, 19px)" : "clamp(13px, 0.95vw, 17px)",
	})

	if (general.badgeStyle === "glass") applyGlass(div, general.glassFrost)
	requestAnimationFrame(() => Object.assign(div.style, { opacity: "1", transform: "none" }))
	fillBadge(div, data, general, personal)
	div.setAttribute(
		"alt",
		"Filtered title: " +
			cardTitle +
			", Fetched title: " +
			data.title +
			", media_type: " +
			data.media_type +
			", source: " +
			data.source +
			", Vote count: " +
			getRatingVoteCount(data),
	)
	return div
}

// puts the badge in its corner of the card, and the grey wash over the artwork when dimmed; returns what was added
export function placeBadge(div: HTMLElement, placement: BadgeHost | null, dimmed: boolean): HTMLElement[] {
	if (!placement) return []
	const { host, corner, raise = 0, fit = true } = placement
	if (raise) div.style.bottom = `calc(${(raise * 100).toFixed(1)}% + ${BADGE_INSET_PX}px)`
	host.appendChild(div)
	if (fit) fitBadgeToCorner(div, host, corner, raise)
	if (!dimmed) return [div]
	const greyOverlay = document.createElement("div")
	Object.assign(greyOverlay.style, {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		background: color.dimOverlay,
		pointerEvents: "none",
		zIndex: 2,
	})
	host.appendChild(greyOverlay)
	return [div, greyOverlay]
}

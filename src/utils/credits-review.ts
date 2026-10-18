import { friendColors, palette } from "@/design/tokens"
import { installPageFeatureStyle } from "./page-feature-styles"
import { BIDI_MARKS, type FeatureRating } from "./page-features"
import { getLetterboxdSlug } from "./ratings"
import { RATING_SOURCES, getScoreColor } from "./rating-sources"

// Who's watching, as far as the credits review needs to know.
export type ReviewViewer = {
	// Letterboxd username, "" when none is linked
	username: string
	// your diary rating for this film (0 = logged without a rating), undefined when it isn't in your diary
	watched?: number
	// friends' ratings are switched on
	friends: boolean
}

type ReviewState = "friends" | "nobody" | "logged" | "unlinked" | "plain"

const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="${palette.tangerine}"/><circle cx="24" cy="32" r="14" fill="${palette.couch}"/><circle cx="40" cy="32" r="14" fill="${palette.popcorn}"/><path d="M32 20.51 A14 14 0 0 1 32 43.49 A14 14 0 0 1 32 20.51 Z" fill="${palette.tangerine}"/></svg>`
const FRIENDS_IN_CARD = 3

// How long the credits probably run, in seconds, when the service doesn't say: about 7% of the runtime, between 3 and
// 10 minutes (around 8 minutes for a 2-hour film). It errs a little early; the pill stays collapsed, so showing
// during the last scene of a film with short credits is fine.
export function creditsLength(duration: number) {
	return Math.min(10 * 60, Math.max(3 * 60, duration * 0.07))
}

// The title in the player's tab title ("The Batman • HBO Max", "Prime Video: Dune", "Glee | Disney+"), without the service's name or the
// invisible direction marks Max wraps it in; undefined when it's only the service's name
export function playerTitle(raw: string | null | undefined) {
	const title = raw
		?.replace(BIDI_MARKS, "")
		.replace(/^Prime Video:\s*/i, "")
		.split(/\s*[•·|]\s*/)[0]
		?.trim()
	return title && !/^(Netflix|Prime Video|HBO\s*Max|Disney\+)$/i.test(title) ? title : undefined
}

// anything shorter is a trailer, an extra or an episode, not a film
export const SHORTEST_FILM = 20 * 60

// where a player is in what it's playing: its <video>, or the player's own clock where the <video>'s isn't the title's
export type PlayerClock = Pick<HTMLVideoElement, "currentTime" | "duration" | "paused">

// a film long enough to be one, playing its credits. `length` is how long the service says they run, if it does.
export function inCredits(video: PlayerClock, length?: number) {
	return (
		Number.isFinite(video.duration) &&
		video.duration >= SHORTEST_FILM &&
		video.currentTime >= video.duration - (length ?? creditsLength(video.duration))
	)
}

// a film, or a show Letterboxd lists as a film (a limited series, offered at its last episode)
export function reviewable(data: FeatureRating) {
	return data.media_type === "movie" || (data.media_type === "tv" && data.source === "letterboxd")
}
export function reviewState(data: FeatureRating, viewer: ReviewViewer): ReviewState {
	if (!viewer.username) return "unlinked"
	if (viewer.watched !== undefined) return "logged"
	if (!viewer.friends) return "plain"
	if (data.friends_count) return "friends"
	// only when Letterboxd answered that none of them have: IMDb or TMDb results, or a failed friends lookup, say
	// nothing about your friends
	return data.source === "letterboxd" && data.friends_count === 0 ? "nobody" : "plain"
}

// 4.5 -> four filled stars, a half-filled one and none empty: always five stars, so ratings line up
export function starText(rating: number): { filled: string; half: boolean; empty: string } {
	const full = Math.floor(rating)
	const half = rating - full >= 0.5
	return { filled: "★".repeat(full), half, empty: "★".repeat(Math.max(0, 5 - full - (half ? 1 : 0))) }
}

function faceColor(name: string) {
	const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
	return friendColors[hash % friendColors.length]
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") {
	const element = document.createElement(tag)
	if (className) element.className = className
	if (text) element.textContent = text
	return element
}

function face(name: string) {
	const span = el("span", "sb-review-face", name.slice(0, 1).toUpperCase())
	span.style.background = faceColor(name)
	span.title = name
	return span
}

function scorePill(source: FeatureRating["source"], rating: number) {
	const pill = el("span", "sb-review-score", rating.toFixed(1))
	pill.style.background = getScoreColor(source, rating)
	return pill
}

function stars(rating: number) {
	const { filled, half, empty } = starText(rating)
	const span = el("span", "sb-review-stars", filled)
	span.setAttribute("aria-label", `${rating} stars`)
	if (half) span.append(el("i", "sb-review-half", "★"))
	if (empty) span.append(el("s", "", empty))
	return span
}

function link(className: string, href: string, text: string) {
	const a = el("a", className, text)
	a.href = href
	a.target = "_blank"
	a.rel = "noopener noreferrer"
	return a
}

// The end-of-film review: a pill over the player once a film's credits roll, which expands into a card with
// what your friends thought and a link to log it on Letterboxd. It never logs anything itself.
export class CreditsRatingPrompt {
	private prompted = new Set<string>()
	private current = ""
	constructor(private openSetup: () => void = () => {}) {}

	get showing() {
		return !!document.querySelector(".sb-review")
	}

	private clear() {
		document.querySelectorAll(".sb-review").forEach((element) => element.remove())
	}

	tick(
		video: PlayerClock | null,
		data: FeatureRating | null,
		enabled: boolean,
		viewer: ReviewViewer = { username: "", friends: true },
		// how long the service says the credits run
		serviceCredits?: number,
	) {
		const key = data ? `${data.media_type}:${data.id}` : ""
		if (this.current !== key) this.clear()
		this.current = key
		if (!enabled || !video || !data || !reviewable(data) || !inCredits(video, serviceCredits)) {
			this.clear()
			return
		}
		if (this.prompted.has(key)) return
		this.prompted.add(key)
		installPageFeatureStyle()
		const container = document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : document.body
		container.append(this.render(data, viewer))
	}

	private render(data: FeatureRating, viewer: ReviewViewer) {
		const state = reviewState(data, viewer)
		const filmUrl = data.rating_url?.startsWith("https://letterboxd.com/film/")
			? data.rating_url
			: `https://letterboxd.com/tmdb/${data.id}/`
		const slug = getLetterboxdSlug(data.rating_url)
		const friends = data.friends ?? []
		const friendsCount = data.friends_count ?? friends.length
		const score = data.source === "tmdb" ? (data.rating ?? data.score) : data.rating

		const root = el("aside", `sb-review sb-review-${state}`)
		root.setAttribute("aria-label", `Review ${data.title}`)
		const dismiss = () => root.remove()

		// the card's contents, which the pill grows to make room for
		const card = el("div", "sb-review-card")
		card.id = `sb-review-card-${data.id}`
		const inner = el("div", "sb-review-card-inner")
		card.append(inner)
		const head = el("div", "sb-review-head")
		head.insertAdjacentHTML("beforeend", LOGO)
		head.append(el("span", "sb-review-brand", "streamBuddy"))
		const close = el("button", "sb-review-close", "×")
		close.type = "button"
		close.setAttribute("aria-label", "Close")
		close.addEventListener("click", dismiss)
		head.append(close)
		inner.append(head, el("div", "sb-review-heading", `You just finished ${data.title}`))

		const section = el("div", "sb-review-section")
		if (state === "friends") {
			section.append(el("div", "sb-review-label", "Your friends thought"))
			for (const friend of friends.slice(0, FRIENDS_IN_CARD)) {
				const row = el("div", "sb-review-friend")
				row.append(face(friend.name), el("span", "sb-review-name", friend.name), stars(friend.rating))
				section.append(row)
			}
			const average = el("div", "sb-review-average")
			if (data.friends_rating) average.append(scorePill("letterboxd", data.friends_rating))
			average.append(el("span", "", "Friends' average"))
			const count = `${friendsCount} ${friendsCount == 1 ? "friend" : "friends"}`
			average.append(
				slug
					? link(
							"sb-review-more",
							`https://letterboxd.com/${viewer.username}/friends/film/${slug}/`,
							`${count} · see all`,
						)
					: el("span", "sb-review-more", count),
			)
			section.append(average)
		} else {
			const line = el("div", "sb-review-average")
			if (score) line.append(scorePill(data.source, score))
			line.append(el("span", "", RATING_SOURCES[data.source].scoreLabel))
			section.append(line)
			if (state === "unlinked")
				section.append(el("p", "sb-review-note", "Link your Letterboxd to see what your friends thought."))
			if (state === "nobody") section.append(el("p", "sb-review-note", "None of your friends have rated it yet."))
			if (state === "logged") {
				const mine = el("div", "sb-review-friend")
				mine.append(el("span", "sb-review-name", viewer.watched ? "You rated it" : "In your diary"))
				if (viewer.watched) mine.append(stars(viewer.watched))
				section.append(mine)
			}
		}
		inner.append(section)

		const buttons = el("div", "sb-review-buttons")
		if (state === "unlinked") {
			const connect = el("button", "sb-review-primary", "Connect Letterboxd")
			connect.type = "button"
			connect.addEventListener("click", () => {
				this.openSetup()
				dismiss()
			})
			buttons.append(connect, link("sb-review-secondary", filmUrl, "Open on Letterboxd"))
		} else {
			buttons.append(
				link("sb-review-primary", filmUrl, state === "logged" ? "Log on Letterboxd" : "Rate on Letterboxd"),
			)
			const later = el("button", "sb-review-secondary", "Not now")
			later.type = "button"
			later.addEventListener("click", dismiss)
			buttons.append(later)
		}
		inner.append(buttons, el("p", "sb-review-footnote", "Films only. streamBuddy never logs anything for you."))

		// the pill
		const pill = el("div", "sb-review-pill")
		const toggle = el("button", "sb-review-toggle")
		toggle.type = "button"
		toggle.insertAdjacentHTML("beforeend", LOGO)
		const text = el("span", "sb-review-text")
		text.append(el("b", "", state === "logged" ? data.title : `Review ${data.title}`))
		const sub = el("span", "sb-review-sub")
		if (state === "friends") sub.textContent = `${friendsCount} ${friendsCount == 1 ? "friend" : "friends"} rated it`
		else if (state === "nobody") sub.textContent = "Be the first of your friends"
		else if (state === "unlinked") sub.textContent = "No Letterboxd linked"
		else if (state === "plain") sub.textContent = "Rate it on Letterboxd"
		else if (viewer.watched) sub.append("You rated it ", stars(viewer.watched))
		else sub.textContent = "In your diary"
		text.append(sub)
		toggle.append(text)
		if (state === "friends") {
			const faces = el("span", "sb-review-faces")
			friends.slice(0, 3).forEach((friend) => faces.append(face(friend.name)))
			toggle.append(faces)
		}
		const pillScore = state === "friends" ? data.friends_rating : state === "logged" ? undefined : score
		if (pillScore) toggle.append(scorePill(state === "friends" ? "letterboxd" : data.source, pillScore))
		pill.append(toggle)
		if (state === "logged") pill.append(link("sb-review-action", filmUrl, "Log again?"))
		if (state === "unlinked") {
			const connect = el("button", "sb-review-action sb-review-ghost", "Connect")
			connect.type = "button"
			connect.addEventListener("click", () => {
				this.openSetup()
				dismiss()
			})
			pill.append(connect)
		}
		const chevron = el("button", "sb-review-chevron")
		chevron.type = "button"
		chevron.setAttribute("aria-label", "Show details")
		chevron.insertAdjacentHTML(
			"beforeend",
			`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
		)
		pill.append(chevron)

		const setOpen = (open: boolean) => {
			// kept in the page while closed so it can grow open; inert keeps it out of reach
			card.inert = !open
			card.setAttribute("aria-hidden", String(!open))
			root.classList.toggle("sb-review-open", open)
			for (const button of [toggle, chevron]) {
				button.setAttribute("aria-expanded", String(open))
				button.setAttribute("aria-controls", card.id)
			}
			chevron.setAttribute("aria-label", open ? "Hide details" : "Show details")
		}
		setOpen(false)
		toggle.addEventListener("click", () => setOpen(card.inert))
		chevron.addEventListener("click", () => setOpen(card.inert))
		// following a link to Letterboxd is the end of it
		root.addEventListener("click", (event) => {
			if ((event.target as Element).closest?.("a")) dismiss()
		})
		root.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return
			event.preventDefault()
			if (!card.inert) {
				setOpen(false)
				toggle.focus()
			} else dismiss()
		})
		// one shape: the pill when closed, the card when open
		const shell = el("div", "sb-review-shell")
		shell.append(card, pill)
		root.append(shell)
		return root
	}
}

// Page clean-ups a viewer would want: no rows of mobile games or the ranked Top 10 on Netflix, optionally no
// Prime Video titles that need renting, buying or an extra subscription, and no autoplay previews with sound.
// Hidden items are marked so they can come back; videos are only unmuted if streamBuddy muted them.
const HIDDEN_ATTR = "data-streambuddy-hidden"

function hide(element: Element | null | undefined, reason: string) {
	if (!element || element.hasAttribute(HIDDEN_ATTR)) return
	element.setAttribute(HIDDEN_ATTR, reason)
	;(element as HTMLElement).style.display = "none"
}
function hidden(reason: string) {
	return Array.from(document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}="${reason}"]`))
}
function show(element: HTMLElement) {
	element.removeAttribute(HIDDEN_ATTR)
	element.style.display = ""
}
function restore(reason: string) {
	hidden(reason).forEach(show)
}

const GAME_CARDS = 'a[data-uia="cloud-game-card"], [data-uia*="game-card"]'

const TOP10_CARDS = 'a[data-uia="ranked-card"]'
const ROW = "section, .lolomoRow"

export function tidyNetflix(hideGames: boolean, hideTop10 = false) {
	if (!hideGames) restore("games")
	else {
		// Netflix reuses a search cell for another result, so one that no longer holds a game comes back
		for (const element of hidden("games"))
			if (
				!element.matches(`${GAME_CARDS}, .mobile-games-row`) &&
				!element.querySelector(`${GAME_CARDS}, .mobile-games-row`)
			)
				show(element)
		for (const card of Array.from(document.querySelectorAll(GAME_CARDS)))
			// search results put games in the same grid as everything else, so there only the game's own cell goes (or
			// the card, should Netflix lay the grid out differently), never the section holding every result
			hide(
				card.closest('[data-uia="search-page"]')
					? (card.closest('[data-uia="gallery"] > * > *') ?? card)
					: card.closest(ROW),
				"games",
			)
		for (const row of Array.from(document.querySelectorAll(".mobile-games-row"))) hide(row.closest(ROW) ?? row, "games")
	}
	if (!hideTop10) restore("top10")
	else for (const card of Array.from(document.querySelectorAll(TOP10_CARDS))) hide(card.closest(ROW), "top10")
}

// each preview is muted once, when it first appears, so one the viewer unmutes keeps its sound; turning quiet
// browsing off only unmutes the videos streamBuddy muted itself
let seen = new WeakSet<HTMLVideoElement>()
const mutedByUs = new Set<HTMLVideoElement>()
export function quietPreviews(on: boolean) {
	if (!on) {
		for (const video of mutedByUs) if (video.isConnected && video.muted) video.muted = false
		mutedByUs.clear()
		seen = new WeakSet()
		return
	}
	for (const video of Array.from(document.querySelectorAll("video"))) {
		if (seen.has(video)) continue
		seen.add(video)
		if (video.muted) continue
		video.muted = true
		mutedByUs.add(video)
	}
	for (const video of mutedByUs) if (!video.isConnected) mutedByUs.delete(video)
}

export function tidyPrime(hidePaid: boolean) {
	if (!hidePaid) return restore("paid")
	for (const card of Array.from(document.querySelectorAll('article[data-card-entitlement="Unentitled"]')))
		hide(card.closest("li") ?? card, "paid")
}

// re-run a tidy whenever the page adds content, at most once per animation frame
export function keepTidy(run: () => void) {
	let queued = false
	const schedule = () => {
		if (queued) return
		queued = true
		requestAnimationFrame(() => {
			queued = false
			run()
		})
	}
	new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
	schedule()
	return schedule
}

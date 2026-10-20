// Page clean-ups a viewer would want: no rows of mobile games on Netflix, and optionally no Prime Video
// titles that need renting, buying or an extra subscription. Hidden items are marked so they can come back.
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

export function tidyNetflix(hideGames: boolean) {
	if (!hideGames) return restore("games")
	// Netflix reuses a search cell for another result, so one that no longer holds a game comes back
	for (const element of hidden("games"))
		if (!element.querySelector(`${GAME_CARDS}, .mobile-games-row`) && !element.matches(".mobile-games-row"))
			show(element)
	for (const card of Array.from(document.querySelectorAll(GAME_CARDS)))
		// search results put games in the same grid as everything else, so there only the game's own cell goes
		hide(
			card.closest('[data-uia="search-page"] [data-uia="gallery"] > * > *') ?? card.closest("section, .lolomoRow"),
			"games",
		)
	for (const row of Array.from(document.querySelectorAll(".mobile-games-row")))
		hide(row.closest("section, .lolomoRow") ?? row, "games")
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

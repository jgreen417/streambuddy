// Page clean-ups a viewer would want: no rows of mobile games on Netflix, and optionally no Prime Video
// titles that need renting, buying or an extra subscription. Hidden items are marked so they can come back.
const HIDDEN_ATTR = "data-streambuddy-hidden"

function hide(element: Element | null | undefined, reason: string) {
	if (!element || element.hasAttribute(HIDDEN_ATTR)) return
	element.setAttribute(HIDDEN_ATTR, reason)
	;(element as HTMLElement).style.display = "none"
}
function restore(reason: string) {
	for (const element of Array.from(document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}="${reason}"]`))) {
		element.removeAttribute(HIDDEN_ATTR)
		element.style.display = ""
	}
}

export function tidyNetflix(hideGames: boolean) {
	if (!hideGames) return restore("games")
	for (const card of Array.from(document.querySelectorAll('a[data-uia="cloud-game-card"], [data-uia*="game-card"]')))
		hide(card.closest("section, .lolomoRow"), "games")
	for (const row of Array.from(document.querySelectorAll(".mobile-games-row"))) hide(row.closest("section, .lolomoRow") ?? row, "games")
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

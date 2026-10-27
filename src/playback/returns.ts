// Where you were in each show, so coming back to one after a while can remind you: the last season and episode
// streamBuddy saw you play, and when. Kept on this device only; it holds episode numbers, never anything about what
// happens in them.
import { showKey } from "./rules"

const STORAGE_KEY = "showVisits"
// a week or more away counts as coming back
export const RETURN_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const KEPT_SHOWS = 200

export type ShowVisit = { at: number; season: number | null; episode: number | null }
// keyed by normalised show title
export type ShowVisits = Record<string, ShowVisit>
export type ShowReturn = { away: number; last: ShowVisit }

// a return worth a reminder: away long enough, and the last visit was a numbered episode, so it was a show
export function showReturn(visits: ShowVisits, show: string, now: number): ShowReturn | null {
	const last = visits[showKey(show)]
	if (!last || last.episode === null) return null
	const away = now - last.at
	return away >= RETURN_AFTER_MS ? { away, last } : null
}

export function withVisit(visits: ShowVisits, show: string, visit: ShowVisit): ShowVisits {
	const next = { ...visits, [showKey(show)]: visit }
	const keys = Object.keys(next)
	if (keys.length <= KEPT_SHOWS) return next
	keys.sort((a, b) => next[b].at - next[a].at)
	return Object.fromEntries(keys.slice(0, KEPT_SHOWS).map((key) => [key, next[key]]))
}

// 8 days, 3 weeks, 2 months, over a year
export function formatAway(ms: number) {
	const days = Math.floor(ms / (24 * 60 * 60 * 1000))
	const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`
	if (days < 14) return plural(days, "day")
	if (days < 60) return plural(Math.floor(days / 7), "week")
	if (days < 365) return plural(Math.floor(days / 30), "month")
	return "over a year"
}

const place = (last: ShowVisit) =>
	last.season !== null ? `S${last.season} E${last.episode}` : `episode ${last.episode}`
export function returnText(show: string, { away, last }: ShowReturn) {
	return `Back to ${show} after ${formatAway(away)} · you last watched ${place(last)}`
}
export function recapText({ away, last }: ShowReturn) {
	return `Playing the recap · you last watched ${place(last)}, ${formatAway(away)} ago`
}

export async function loadVisits(): Promise<ShowVisits> {
	try {
		const result = await browser.storage.local.get(STORAGE_KEY)
		return (result?.[STORAGE_KEY] as ShowVisits | undefined) ?? {}
	} catch {
		return {}
	}
}
// read again before writing, so another tab's shows aren't lost
export async function saveVisit(show: string, visit: ShowVisit) {
	const visits = await loadVisits()
	await browser.storage.local.set({ [STORAGE_KEY]: withVisit(visits, show, visit) })
}

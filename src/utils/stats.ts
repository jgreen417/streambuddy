// streamBuddy stats: watch time per day/service and the best-rated titles seen on cards.
// Everything lives in browser.storage.local; nothing leaves the browser.
import type { ExternalRating } from "@/utils/ratings"

// { "2026-10-11": { netflix: 5400, amazon: 1200 } } in seconds
export type WatchLog = Record<string, Record<string, number>>
export type SeenTitle = {
	title: string
	source: ExternalRating["source"]
	rating: number
	url: string
	platform: string
	media_type: string
	seen: string
}
export type SeenTop = Record<string, SeenTitle>

export const PLATFORM_NAMES: Record<string, string> = {
	netflix: "Netflix",
	amazon: "Prime Video",
	hbo: "HBO Max",
}

const WATCH_LOG_DAYS = 120
const SEEN_DAYS = 7
const SEEN_KEEP = 25

// local calendar day, so a late-night episode counts towards the evening it started on the user's clock
export function localDateKey(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0")
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function daysAgo(now: Date, days: number) {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

export function addWatchSeconds(log: WatchLog, now: Date, platform: string, seconds: number): WatchLog {
	const key = localDateKey(now)
	const day = { ...log[key] }
	day[platform] = (day[platform] ?? 0) + seconds
	const cutoff = localDateKey(daysAgo(now, WATCH_LOG_DAYS))
	const next: WatchLog = {}
	for (const [date, value] of Object.entries(log)) if (date >= cutoff) next[date] = value
	next[key] = day
	return next
}

const sumDay = (day: Record<string, number> | undefined) => Object.values(day ?? {}).reduce((a, b) => a + b, 0)
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export type WatchSummary = {
	thisWeek: number
	lastWeek: number
	days: Array<{ label: string; seconds: number; isToday: boolean }>
	byService: Array<{ platform: string; seconds: number }>
	biggestNight: { weekday: string; averageSeconds: number } | null
}
// "week" = the last 7 days including today, compared with the 7 before
export function summarizeWatchLog(log: WatchLog, now: Date): WatchSummary {
	const days = []
	const services: Record<string, number> = {}
	let thisWeek = 0
	let lastWeek = 0
	for (let i = 13; i >= 0; i--) {
		const date = daysAgo(now, i)
		const day = log[localDateKey(date)]
		const seconds = sumDay(day)
		if (i < 7) {
			thisWeek += seconds
			for (const [platform, value] of Object.entries(day ?? {})) services[platform] = (services[platform] ?? 0) + value
			days.push({ label: i == 0 ? "Today" : WEEKDAYS[date.getDay()].slice(0, 3), seconds, isToday: i == 0 })
		} else lastWeek += seconds
	}
	const byService = Object.entries(services)
		.map(([platform, seconds]) => ({ platform, seconds }))
		.filter((service) => service.seconds > 0)
		.sort((a, b) => b.seconds - a.seconds)

	// biggest night over the last 8 weeks: highest average on the days of that weekday you watched anything
	const perWeekday = WEEKDAYS.map(() => ({ total: 0, days: 0 }))
	for (let i = 0; i < 56; i++) {
		const date = daysAgo(now, i)
		const seconds = sumDay(log[localDateKey(date)])
		if (seconds > 0) {
			perWeekday[date.getDay()].total += seconds
			perWeekday[date.getDay()].days++
		}
	}
	let biggestNight: WatchSummary["biggestNight"] = null
	perWeekday.forEach((weekday, index) => {
		if (weekday.days == 0) return
		const averageSeconds = weekday.total / weekday.days
		if (!biggestNight || averageSeconds > biggestNight.averageSeconds)
			biggestNight = { weekday: WEEKDAYS[index], averageSeconds }
	})
	return { thisWeek, lastWeek, days, byService, biggestNight }
}

// Rough percentile among popular streaming titles, so Letterboxd (/5) and IMDb (/10) can be ranked together.
// Anchors match the colour bands in ratings.ts (13/36/60/85% of titles fall below each edge).
const PERCENTILE_ANCHORS: Record<ExternalRating["source"], Array<[number, number]>> = {
	letterboxd: [
		[1, 0],
		[2.5, 13],
		[3, 36],
		[3.5, 60],
		[4, 85],
		[4.7, 100],
	],
	imdb: [
		[5.5, 0],
		[7, 13],
		[7.7, 36],
		[8.2, 60],
		[8.6, 85],
		[9.5, 100],
	],
}
export function getRatingPercentile(source: ExternalRating["source"], rating: number): number {
	const anchors = PERCENTILE_ANCHORS[source]
	if (rating <= anchors[0][0]) return 0
	for (let i = 1; i < anchors.length; i++) {
		const [x0, y0] = anchors[i - 1]
		const [x1, y1] = anchors[i]
		if (rating <= x1) return y0 + ((rating - x0) / (x1 - x0)) * (y1 - y0)
	}
	return 100
}

export function mergeSeenTitles(stored: SeenTop, entries: SeenTitle[], now: Date): SeenTop {
	const merged: SeenTop = { ...stored }
	for (const entry of entries) merged[entry.title] = entry
	const cutoff = localDateKey(daysAgo(now, SEEN_DAYS - 1))
	const kept = Object.values(merged)
		.filter((entry) => entry.seen >= cutoff)
		.sort((a, b) => getRatingPercentile(b.source, b.rating) - getRatingPercentile(a.source, a.rating))
		.slice(0, SEEN_KEEP)
	return Object.fromEntries(kept.map((entry) => [entry.title, entry]))
}

export function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60)
	if (minutes < 60) return `${minutes}m`
	const hours = Math.floor(minutes / 60)
	return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`
}

export function recentSeenTitles(titles: SeenTop, now: Date): SeenTitle[] {
	const cutoff = localDateKey(daysAgo(now, SEEN_DAYS - 1))
	const today = localDateKey(now)
	return Object.values(titles).filter((title) => title.seen >= cutoff && title.seen <= today)
}

// time saved by skipping, same shape as WatchLog but keyed by what was skipped: { "2026-10-12": { intro: 85, ad: 60 } }
export type SavedLog = WatchLog
export const addSavedSeconds = addWatchSeconds
export function sumLastDays(log: WatchLog, now: Date, days: number): number {
	const cutoff = localDateKey(daysAgo(now, days - 1))
	return Object.entries(log)
		.filter(([date]) => date >= cutoff)
		.reduce((total, [, day]) => total + sumDay(day), 0)
}

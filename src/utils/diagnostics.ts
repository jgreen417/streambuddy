// The numbers the Diagnostics section reads from local storage. Counts only: a diagnostics report should never carry
// someone's viewing history or the titles they looked at.
import type { LetterboxdProfile } from "./ratings"
import type { WatchLog } from "./stats"

export type DiagnosticsSnapshot = {
	DBCache?: Record<string, unknown>
	letterboxdProfile?: LetterboxdProfile
	titleOverrides?: Record<string, unknown>
	watchLog?: WatchLog
	savedLog?: WatchLog
}

export type DiagnosticsSummary = {
	cacheTitles: number
	cacheBytes: number
	profileFilms: number
	profileWatchlist: number
	profileSynced: string
	fixedTitles: number
	watchDays: number
	savedSeconds: number
}

const sum = (log: WatchLog | undefined) =>
	Object.values(log ?? {}).reduce((total, day) => total + Object.values(day).reduce((a, b) => a + b, 0), 0)

export function relativeSync(fetchedAt: number | undefined, now = new Date()): string {
	if (!fetchedAt) return "not synced yet"
	const minutes = Math.max(0, Math.floor((now.getTime() - fetchedAt) / 60_000))
	if (minutes < 1) return "just now"
	if (minutes < 60) return `${minutes} min ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours} h ago`
	return `${Math.floor(hours / 24)} d ago`
}

export function summarize(snapshot: DiagnosticsSnapshot, now = new Date()): DiagnosticsSummary {
	const cache = snapshot.DBCache ?? {}
	const profile = snapshot.letterboxdProfile
	return {
		cacheTitles: Object.keys(cache).length,
		cacheBytes: new TextEncoder().encode(JSON.stringify(cache)).length,
		profileFilms: Object.keys(profile?.watched ?? {}).length,
		profileWatchlist: profile?.watchlist?.length ?? 0,
		profileSynced: profile ? relativeSync(profile.fetchedAt, now) : "not connected",
		fixedTitles: Object.keys(snapshot.titleOverrides ?? {}).length,
		watchDays: Object.keys(snapshot.watchLog ?? {}).length,
		savedSeconds: sum(snapshot.savedLog),
	}
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// The text behind "Copy diagnostics": version/browser plus counts, never titles or a Letterboxd username.
export function diagnosticsReport(summary: DiagnosticsSummary, meta: { version: string; browser: string }): string {
	return JSON.stringify(
		{
			version: meta.version,
			browser: meta.browser,
			ratingCache: { titles: summary.cacheTitles, bytes: summary.cacheBytes },
			letterboxdProfile: {
				films: summary.profileFilms,
				watchlist: summary.profileWatchlist,
				synced: summary.profileSynced,
			},
			fixedTitles: summary.fixedTitles,
			watchHistory: { days: summary.watchDays, savedSeconds: summary.savedSeconds },
		},
		null,
		2,
	)
}

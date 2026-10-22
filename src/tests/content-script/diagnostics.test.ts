import { describe, expect, it } from "vitest"
import { diagnosticsReport, summarize } from "../../utils/diagnostics"

const NOW = new Date("2026-10-22T12:00:00Z")
const SNAPSHOT = {
	DBCache: { Dune: { id: 1, title: "Dune" } },
	letterboxdProfile: {
		username: "buddy",
		fetchedAt: NOW.getTime() - 12 * 60_000,
		watched: { dune: 4, arrival: 0 },
		watchlist: ["dune", "arrival", "heat"],
	},
	titleOverrides: { "dune part two": { id: 2 } },
	watchLog: { "2026-10-21": { netflix: 3600 } },
	savedLog: { "2026-10-21": { intro: 120, ad: 60 } },
}

describe("diagnostics", () => {
	it("summarises local storage without touching the titles", () => {
		const summary = summarize(SNAPSHOT, NOW)
		expect(summary).toMatchObject({
			cacheTitles: 1,
			profileFilms: 2,
			profileWatchlist: 3,
			profileSynced: "12 min ago",
			fixedTitles: 1,
			watchDays: 1,
			savedSeconds: 180,
		})
		expect(summary.cacheBytes).toBeGreaterThan(0)
	})
	it("keeps the copied report to counts and build details", () => {
		const report = diagnosticsReport(summarize(SNAPSHOT, NOW), { version: "1.0.6", browser: "Chrome" })
		expect(report).toContain('"version": "1.0.6"')
		expect(report).toContain('"fixedTitles": 1')
		expect(report).not.toContain("Dune")
		expect(report).not.toContain("buddy")
	})
})

import { describe, it, expect } from "vitest"
import {
	addWatchSeconds,
	formatDuration,
	getRatingPercentile,
	localDateKey,
	mergeSeenTitles,
	summarizeWatchLog,
	type SeenTitle,
	type WatchLog,
} from "../../utils/stats"

// Sunday 11 Oct 2026, evening
const now = new Date(2026, 9, 11, 21, 30)
const day = (offset: number) => localDateKey(new Date(2026, 9, 11 - offset))

describe("addWatchSeconds", () => {
	it("adds to today's platform total and drops days older than 120", () => {
		let log: WatchLog = { [day(200)]: { netflix: 60 }, [day(0)]: { netflix: 100 } }
		log = addWatchSeconds(log, now, "netflix", 15)
		log = addWatchSeconds(log, now, "hbo", 30)
		expect(log).toEqual({ [day(0)]: { netflix: 115, hbo: 30 } })
	})
})

describe("summarizeWatchLog", () => {
	const log: WatchLog = {
		[day(0)]: { netflix: 3600 },
		[day(1)]: { amazon: 1800, netflix: 600 },
		[day(6)]: { hbo: 1200 },
		[day(7)]: { netflix: 5000 },
		[day(13)]: { netflix: 1000 },
		[day(14)]: { netflix: 9999 },
	}
	const summary = summarizeWatchLog(log, now)

	it("totals the last 7 days against the 7 before", () => {
		expect(summary.thisWeek).toBe(3600 + 2400 + 1200)
		expect(summary.lastWeek).toBe(6000)
	})

	it("lists 7 days ending today", () => {
		expect(summary.days.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"])
		expect(summary.days.at(-1)).toEqual({ label: "Today", seconds: 3600, isToday: true })
	})

	it("splits this week by service, biggest first", () => {
		expect(summary.byService).toEqual([
			{ platform: "netflix", seconds: 4200 },
			{ platform: "amazon", seconds: 1800 },
			{ platform: "hbo", seconds: 1200 },
		])
	})

	it("finds the weekday with the highest average", () => {
		// Sundays: 3600, 5000 and 9999 -> avg 6200, ahead of Saturday's 2400 and Monday's 1200
		expect(summary.biggestNight?.weekday).toBe("Sunday")
		expect(summary.biggestNight?.averageSeconds).toBeCloseTo(6199.67, 1)
	})

	it("handles an empty log", () => {
		const empty = summarizeWatchLog({}, now)
		expect(empty.thisWeek).toBe(0)
		expect(empty.byService).toEqual([])
		expect(empty.biggestNight).toBeNull()
	})
})

describe("getRatingPercentile", () => {
	it("puts Letterboxd and IMDb on one scale", () => {
		expect(getRatingPercentile("letterboxd", 3.5)).toBe(60)
		expect(getRatingPercentile("imdb", 8.2)).toBe(60)
		expect(getRatingPercentile("letterboxd", 4.6)).toBeGreaterThan(getRatingPercentile("imdb", 8.6))
		expect(getRatingPercentile("imdb", 4)).toBe(0)
		expect(getRatingPercentile("letterboxd", 5)).toBe(100)
	})
})

describe("mergeSeenTitles", () => {
	const title = (name: string, source: SeenTitle["source"], rating: number, seen = day(0)): SeenTitle => ({
		title: name,
		source,
		rating,
		url: "",
		platform: "netflix",
		media_type: "movie",
		seen,
	})

	it("ranks across sources and forgets titles not seen this week", () => {
		const merged = mergeSeenTitles(
			{ Old: title("Old", "letterboxd", 4.6, day(9)) },
			[title("Fine", "letterboxd", 3.2), title("Great show", "imdb", 9.1), title("Great film", "letterboxd", 4.4)],
			now,
		)
		expect(Object.keys(merged)).toEqual(["Great film", "Great show", "Fine"])
	})
})

describe("formatDuration", () => {
	it("formats minutes and hours", () => {
		expect(formatDuration(0)).toBe("0m")
		expect(formatDuration(45 * 60)).toBe("45m")
		expect(formatDuration(6 * 3600 + 40 * 60)).toBe("6h 40m")
		expect(formatDuration(3600 + 5 * 60)).toBe("1h 05m")
	})
})

import { afterEach, describe, expect, it, vi } from "vitest"
import { NetflixShowTitles, getEpisodeId } from "../../utils/netflix-shows"

// trimmed from a real pathEvaluator response for the "Super Buzzy Pilot Episodes" row
const jsonGraph = {
	videos: {
		"80057281": { title: { $type: "atom", value: "Stranger Things" } },
		"80077368": { ancestor: { $type: "ref", value: ["videos", "80057281"] } },
		"81437051": { title: { $type: "atom", value: "The Gentlemen" } },
		"81646429": { ancestor: { $type: "ref", value: ["videos", "81437051"] } },
	},
}

describe("Netflix episode cards", () => {
	afterEach(() => vi.useRealTimers())

	it("reads the episode id from the card link", () => {
		expect(getEpisodeId("/browse?jbv=80077368")).toBe("80077368")
		expect(getEpisodeId("/browse?foo=1&jbv=81646429")).toBe("81646429")
		expect(getEpisodeId("/title/80077368")).toBeNull()
		expect(getEpisodeId(null)).toBeNull()
	})

	it("looks up the shows for a row of episodes in one request", async () => {
		vi.useFakeTimers()
		const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ jsonGraph }) }) as Response)
		const titles = new NetflixShowTitles(fetcher)

		expect(titles.get("80077368")).toBeUndefined()
		expect(titles.get("81646429")).toBeUndefined()
		expect(titles.get("123")).toBeUndefined()
		await vi.runAllTimersAsync()

		expect(fetcher).toHaveBeenCalledOnce()
		const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
		const body = decodeURIComponent(String(init.body))
		expect(body).toBe('path=["videos",[80077368,81646429,123],"ancestor","title"]')
		expect(titles.get("80077368")).toBe("Stranger Things")
		expect(titles.get("81646429")).toBe("The Gentlemen")
		expect(titles.get("123")).toBeNull()
	})

	it("keeps reporting a lookup as pending until Netflix answers", async () => {
		vi.useFakeTimers()
		let answer!: (response: Response) => void
		const fetcher = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)))
		const titles = new NetflixShowTitles(fetcher)
		titles.get("80077368")
		await vi.advanceTimersByTimeAsync(100)
		expect(titles.get("80077368")).toBeUndefined()
		answer({ ok: true, json: async () => ({ jsonGraph }) } as Response)
		await vi.runAllTimersAsync()
		expect(titles.get("80077368")).toBe("Stranger Things")
		expect(fetcher).toHaveBeenCalledOnce()
	})

	it("leaves the episodes unrated instead of retrying when Netflix refuses", async () => {
		vi.useFakeTimers()
		const fetcher = vi.fn(async () => ({ ok: false, status: 412 }) as Response)
		const titles = new NetflixShowTitles(fetcher)
		titles.get("80077368")
		await vi.runAllTimersAsync()
		expect(titles.get("80077368")).toBeNull()
		await vi.runAllTimersAsync()
		expect(fetcher).toHaveBeenCalledOnce()
	})
})

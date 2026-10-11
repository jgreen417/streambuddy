import { afterEach, describe, expect, it, vi } from "vitest"
import { addLetterboxdWatchlist, extractLetterboxdCsrf, CreditsRatingPrompt } from "../../utils/letterboxd-actions"

describe("Letterboxd account actions", () => {
	afterEach(() => vi.unstubAllGlobals())
	it("reads a CSRF field independent of attribute ordering", () => {
		expect(extractLetterboxdCsrf('<input value="test-token" type="hidden" name="__csrf">')).toBe("test-token")
		expect(extractLetterboxdCsrf('<input name="__csrf" value="test-token">')).toBe("test-token")
	})
	it("uses the actual script token instead of Letterboxd's placeholder fields", () => {
		expect(
			extractLetterboxdCsrf(
				'<input name="__csrf" value="placeholder"><script>supermodelCSRF = "actual-test-token";</script>',
			),
		).toBe("actual-test-token")
		expect(extractLetterboxdCsrf('<input name="__csrf" value="placeholder">')).toBeNull()
	})
	it("does not even fetch when confirmation is absent", async () => {
		const fetcher = vi.fn()
		vi.stubGlobal("fetch", fetcher)
		await expect(addLetterboxdWatchlist("film", false)).rejects.toThrow("Confirmation")
		expect(fetcher).not.toHaveBeenCalled()
	})
	it("sends only the confirmed watchlist action and rejects unconfirmed responses", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, text: async () => '<input name="__csrf" value="test-token">' })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ result: true }) })
		vi.stubGlobal("fetch", fetcher)
		await addLetterboxdWatchlist("the-film-2026", true)
		expect(fetcher.mock.calls[1][0]).toBe("https://letterboxd.com/film/the-film-2026/add-to-watchlist/")
		expect(fetcher.mock.calls[1][1].credentials).toBe("include")
		expect(fetcher.mock.calls[1][1].body.toString()).toBe("__csrf=test-token")
	})
	it("never posts when the signed-in form cannot be read", async () => {
		const fetcher = vi.fn(async () => ({ ok: true, text: async () => "Sign in" }))
		vi.stubGlobal("fetch", fetcher)
		await expect(addLetterboxdWatchlist("film", true)).rejects.toThrow("Letterboxd")
		expect(fetcher).toHaveBeenCalledTimes(1)
	})
	it("clears an old film prompt when playback ends or switches context", () => {
		document.body.innerHTML = ""
		const prompt = new CreditsRatingPrompt(),
			video = document.createElement("video")
		Object.defineProperty(video, "duration", { value: 3600 })
		video.currentTime = 3550
		const film = {
			id: 1,
			title: "Film",
			media_type: "movie",
			source: "letterboxd" as const,
			rating_url: "https://letterboxd.com/film/film/",
		}
		prompt.tick(video, film, true)
		expect(document.querySelector(".sb-rate-prompt")).not.toBeNull()
		prompt.tick(null, null, true)
		expect(document.querySelector(".sb-rate-prompt")).toBeNull()
	})
})

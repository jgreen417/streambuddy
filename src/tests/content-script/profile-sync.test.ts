import { describe, it, expect } from "vitest"
import type { LetterboxdProfile } from "../../utils/ratings"
import { createProfileSync } from "../../utils/profile-sync"
const old = { username: "person", fetchedAt: 1, watched: { film: 4 }, watchlist: ["next"] }
describe("manual and automatic profile sync", () => {
	it("reports a failed forced refresh instead of returning a cached success", async () => {
		const sync = createProfileSync("person", {
			read: async () => old,
			fetch: async () => {
				throw new Error("Offline")
			},
			write: async () => {},
		})
		const result = await sync(true)
		expect(result).toMatchObject({ error: expect.any(String) })
	})
	it("keeps automatic browsing usable with the cached profile after a failed refresh", async () => {
		const sync = createProfileSync("person", {
			read: async () => old,
			fetch: async () => {
				throw new Error("Offline")
			},
			write: async () => {},
		})
		expect(await sync(false)).toEqual(old)
	})
	it("does not substitute another profile after a failed fetch", async () => {
		const sync = createProfileSync("another", { read: async () => old, fetch: async () => null, write: async () => {} })
		expect(await sync(false)).toBeNull()
	})
	it("persists the fetched profile before returning success", async () => {
		const fresh = { ...old, fetchedAt: Date.now(), watchlist: ["next", "film"] }
		let saved: LetterboxdProfile = old
		const sync = createProfileSync("person", {
			read: async () => old,
			fetch: async () => fresh,
			write: async (value) => {
				saved = value
			},
		})
		expect(await sync(true)).toEqual(fresh)
		expect(saved.watchlist).toEqual(["next", "film"])
	})
})

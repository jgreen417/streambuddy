import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearOverride, loadOverrides, overrideFor, overrideKey, saveOverride } from "../../content-script/overrides"

const DUNE = { id: 693134, media_type: "movie" as const, title: "Dune: Part Two", year: "2024" }

describe("title overrides", () => {
	beforeEach(async () => {
		vi.mocked(browser.storage.local.get).mockResolvedValue({})
		vi.mocked(browser.storage.local.set).mockResolvedValue(undefined)
		await loadOverrides()
	})
	afterEach(async () => {
		await clearOverride("Dune: Part Two")
	})
	it("treats punctuation and case as the same card title", () => {
		expect(overrideKey("Dune: Part Two")).toBe("dune part two")
		expect(overrideKey("  DUNE — part two ")).toBe("dune part two")
		expect(overrideKey("君の名は。")).toBe("君の名は")
		expect(overrideKey("Москва")).not.toBe(overrideKey("पठान"))
	})
	it("saves a correction and reads it back through the normalised title", async () => {
		await saveOverride("Dune: Part Two", DUNE)
		expect(overrideFor("dune part two")).toEqual(DUNE)
		expect(browser.storage.local.set).toHaveBeenCalledWith({
			titleOverrides: expect.objectContaining({ "dune part two": DUNE }),
		})
	})
	it("forgets a correction when it is cleared", async () => {
		await saveOverride("Dune: Part Two", DUNE)
		await clearOverride("DUNE: PART TWO")
		expect(overrideFor("Dune: Part Two")).toBeUndefined()
	})
})

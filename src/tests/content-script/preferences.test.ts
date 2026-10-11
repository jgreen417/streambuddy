import { describe, expect, it } from "vitest"
import { getServiceState, setServiceState, getRatingMode, setRatingMode } from "../../utils/preferences"
import { defaultSettings, type settingsType } from "../../stores/storeTypes"
const fresh = () => structuredClone(defaultSettings) as settingsType

describe("preference edits", () => {
	it("distinguishes mixed values without changing stored preferences", () => {
		const settings = fresh()
		settings.Netflix.skipRecap = false
		expect(getServiceState(settings, ["Netflix"], ["skipIntro", "skipRecap"])).toBe("mixed")
		expect(settings.Netflix.skipRecap).toBe(false)
		expect(getServiceState(settings, ["Netflix"], ["skipIntro"])).toBe(true)
	})
	it("includes Crunchyroll in explicitly selected bulk edits", () => {
		const settings = fresh()
		settings.Crunchyroll.skipIntro = false
		expect(getServiceState(settings, ["Netflix", "Crunchyroll"], ["skipIntro"])).toBe("mixed")
		setServiceState(settings, ["Netflix", "Crunchyroll"], ["skipIntro"], true)
		expect(settings.Crunchyroll.skipIntro).toBe(true)
	})
	it("ignores services without a setting, like Crunchyroll ratings", () => {
		const settings = fresh()
		expect(getServiceState(settings, ["Netflix", "Crunchyroll"], ["showRating"])).toBe(true)
		setServiceState(settings, ["Crunchyroll"], ["showRating"], true)
		expect("showRating" in settings.Crunchyroll).toBe(false)
	})
	it("changes only selected services and mutually exclusive credit preferences", () => {
		const settings = fresh()
		settings.Netflix.watchCredits = true
		settings.Netflix.skipCredits = false
		setServiceState(settings, ["Netflix"], ["skipCredits"], true)
		expect(settings.Netflix.watchCredits).toBe(false)
		expect(settings.Amazon.watchCredits).toBe(false)
		setServiceState(settings, ["Netflix"], ["watchCredits"], true)
		expect(settings.Netflix.skipCredits).toBe(false)
		expect(settings.Amazon.skipCredits).toBe(true)
	})
	it("reads legacy combined cutoff flags without normalizing them", () => {
		const settings = fresh()
		settings.Video.dimLowRatings = true
		settings.General.hideBelowRating = true
		expect(getRatingMode(settings, true)).toBe("hide")
		expect(getRatingMode(settings, false)).toBe("dim")
		expect(settings.Video.dimLowRatings).toBe(true)
		expect(settings.General.hideBelowRating).toBe(true)
	})
	it("preserves global hiding when changing dimming on an unsupported service", () => {
		const settings = fresh()
		settings.General.hideBelowRating = true
		setRatingMode(settings, "off", false)
		expect(settings.General.hideBelowRating).toBe(true)
		expect(settings.Video.dimLowRatings).toBe(false)
	})
	it("normalizes mode only after a deliberate supported-service choice", () => {
		const settings = fresh()
		settings.Video.dimLowRatings = true
		settings.General.hideBelowRating = true
		setRatingMode(settings, "dim", true)
		expect(settings.General.hideBelowRating).toBe(false)
		expect(settings.Video.dimLowRatings).toBe(true)
		setRatingMode(settings, "hide", true)
		expect(settings.General.hideBelowRating).toBe(true)
		expect(settings.Video.dimLowRatings).toBe(false)
	})
})

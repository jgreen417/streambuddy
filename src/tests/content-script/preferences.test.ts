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
	it("edits several services at once and reports mixed values", () => {
		const settings = fresh()
		settings.HBO.skipIntro = false
		expect(getServiceState(settings, ["Netflix", "HBO"], ["skipIntro"])).toBe("mixed")
		setServiceState(settings, ["Netflix", "HBO"], ["skipIntro"], true)
		expect(settings.HBO.skipIntro).toBe(true)
	})
	it("changes only the selected services", () => {
		const settings = fresh()
		setServiceState(settings, ["Netflix"], ["skipCredits"], false)
		expect(settings.Netflix.skipCredits).toBe(false)
		expect(settings.Amazon.skipCredits).toBe(true)
	})
	it("ignores settings a service doesn't have", () => {
		const settings = fresh()
		setServiceState(settings, ["HBO"], ["hideGames"], true)
		expect("hideGames" in settings.HBO).toBe(false)
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

import { afterEach, describe, it, expect } from "vitest"
import { createApp, h, reactive, nextTick, type App } from "vue"
import ExperiencePreferences from "../../components/popup/ExperiencePreferences.vue"
import { defaultSettings, type settingsType } from "../../stores/storeTypes"
let app: App | undefined
function mount(settings: settingsType) {
	const state = reactive(settings)
	const root = document.createElement("div")
	document.body.append(root)
	app = createApp({ render: () => h(ExperiencePreferences, { settings: state, service: "Netflix", expanded: true }) })
	app.mount(root)
	return { root, state }
}
afterEach(() => {
	app?.unmount()
	document.body.innerHTML = ""
})
const fresh = () => structuredClone(defaultSettings) as settingsType
const toggle = (root: HTMLElement, label: string) =>
	Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((input) =>
		input.closest("label")?.textContent?.includes(label),
	)!
describe("experience preferences integration", () => {
	it("keeps dependent preferences stored when card ratings are disabled", async () => {
		const settings = fresh()
		settings.Netflix.showRating = false
		const { root, state } = mount(settings)
		expect(toggle(root, "Highlight best-rated").disabled).toBe(true)
		expect(state.General.highlightBestInRow).toBe(true)
		toggle(root, "Ratings on title cards").click()
		await nextTick()
		expect(toggle(root, "Highlight best-rated").disabled).toBe(false)
		expect(state.General.highlightBestInRow).toBe(true)
	})
	it("does not change legacy cutoff combinations merely by rendering", () => {
		const settings = fresh()
		settings.Video.dimLowRatings = true
		settings.General.hideBelowRating = true
		const { root, state } = mount(settings)
		expect(root.querySelector<HTMLInputElement>('input[value="hide"]')?.checked).toBe(true)
		expect(state.Video.dimLowRatings).toBe(true)
		expect(state.General.hideBelowRating).toBe(true)
	})
	it("picks which sites badge ratings come from", async () => {
		const { root, state } = mount(fresh())
		const select = Array.from(root.querySelectorAll<HTMLSelectElement>("label.sb-cutoff select")).find((el) =>
			el.closest("label")?.textContent?.includes("Ratings from"),
		)!
		expect(select.value).toBe("both")
		select.value = "imdb"
		select.dispatchEvent(new Event("change"))
		await nextTick()
		expect(state.General.ratingSources).toBe("imdb")
	})
	it("edits an individual recap without changing intros or other services", async () => {
		const { root, state } = mount(fresh())
		toggle(root, "Skip recaps").click()
		await nextTick()
		expect(state.Netflix.skipRecap).toBe(false)
		expect(state.Netflix.skipIntro).toBe(true)
		expect(state.Amazon.skipIntro).toBe(true)
		expect(toggle(root, "Skip intros & recaps").indeterminate).toBe(true)
	})
	it.skipIf(!__LETTERBOXD_USERNAME__)(
		"keeps watchlist actions stored but inactive when title-page ratings are off",
		async () => {
			const settings = fresh()
			settings.General.detailRatings = false
			const { root, state } = mount(settings)
			const action = toggle(root, "Watchlist button")
			expect(action).toBeDefined()
			expect(action.disabled).toBe(true)
			expect(state.General.letterboxdActions).toBe(true)
			toggle(root, "Ratings on title pages").click()
			await nextTick()
			expect(action.disabled).toBe(false)
		},
	)
})

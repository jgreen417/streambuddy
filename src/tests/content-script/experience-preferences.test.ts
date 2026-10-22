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
		const filter = () => root.querySelector<HTMLFieldSetElement>("fieldset.sb-filter")!
		expect(filter().disabled).toBe(true)
		expect(state.General.dimBelowBand).toBe(1)
		toggle(root, "Ratings on title cards").click()
		await nextTick()
		expect(filter().disabled).toBe(false)
		expect(state.General.dimBelowBand).toBe(1)
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
	it("keeps the classic badge by default and shows the glass slider only for Liquid Glass", async () => {
		const { root, state } = mount(fresh())
		const look = (value: string) =>
			root.querySelector<HTMLInputElement>(`.sb-badge-look input[type=radio][value=${value}]`)!
		expect(look("classic").checked).toBe(true)
		expect(root.querySelector(".sb-frost")).toBeNull()
		look("glass").click()
		await nextTick()
		expect(state.General.badgeStyle).toBe("glass")
		const slider = root.querySelector<HTMLInputElement>(".sb-frost input[type=range]")!
		expect(slider.value).toBe("60")
		slider.value = "20"
		slider.dispatchEvent(new Event("input"))
		await nextTick()
		expect(state.General.glassFrost).toBe(20)
	})
	it("turns quiet browsing off and hides Netflix's Top 10 row", async () => {
		const { root, state } = mount(fresh())
		expect(state.General.quietPreviews).toBe(true)
		toggle(root, "Quiet browsing").click()
		await nextTick()
		expect(state.General.quietPreviews).toBe(false)
		toggle(root, "Top 10").click()
		await nextTick()
		expect(state.Netflix.hideTop10).toBe(true)
		expect("hideTop10" in state.Amazon).toBe(false)
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
})

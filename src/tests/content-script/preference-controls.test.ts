import { afterEach, describe, expect, it } from "vitest"
import { createApp, h, nextTick, type App } from "vue"
import PopupToggle from "../../components/popup/PopupToggle.vue"
let app: App | undefined
function mount(props: {
	modelValue: boolean
	label: string
	disabled?: boolean
	mixed?: boolean
	"onUpdate:modelValue": (value: boolean) => void
}) {
	const root = document.createElement("div")
	document.body.append(root)
	app = createApp({ render: () => h(PopupToggle, props) })
	app.mount(root)
	return root
}
afterEach(() => {
	app?.unmount()
	document.body.innerHTML = ""
})
describe("preference control", () => {
	it("makes the visible label toggle the preference", async () => {
		let value = false
		const root = mount({ modelValue: false, label: "Card ratings", "onUpdate:modelValue": (v: boolean) => (value = v) })
		root.querySelector("label")?.click()
		await nextTick()
		expect(value).toBe(true)
	})
	it("keeps an inactive dependent preference stored and cannot edit it", async () => {
		let value = true
		const root = mount({
			modelValue: true,
			label: "Watched fading",
			disabled: true,
			"onUpdate:modelValue": (v: boolean) => (value = v),
		})
		const control = root.querySelector<HTMLInputElement>("input")
		expect(control?.disabled).toBe(true)
		root.querySelector("label")?.click()
		await nextTick()
		expect(value).toBe(true)
	})
	it("exposes mixed settings and resolves them with a deliberate click", async () => {
		let value = false
		const root = mount({
			modelValue: false,
			mixed: true,
			label: "Card ratings",
			"onUpdate:modelValue": (v: boolean) => (value = v),
		})
		const control = root.querySelector<HTMLInputElement>("input")
		expect(control?.getAttribute("aria-checked")).toBe("mixed")
		expect(control?.indeterminate).toBe(true)
		root.querySelector("label")?.click()
		await nextTick()
		expect(value).toBe(true)
	})
})

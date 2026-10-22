import type { BasicColorSchema } from "@vueuse/core"
import { useBrowserLocalStorage } from "./useBrowserStorage"

// daisyUI picks its theme from the body's data-theme
export function useTheme() {
	const { data: colorSchema } = useBrowserLocalStorage<BasicColorSchema>("mode", "dark", false)
	document.body.setAttribute("data-theme", colorSchema.value)
	watch(colorSchema, (mode) => document.body.setAttribute("data-theme", mode))
}

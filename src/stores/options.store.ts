import { useLocale } from "@/composables/useLocale"
import { useTheme } from "@/composables/useTheme"
import { settings } from "./settings"

export const useOptionsStore = defineStore("options", () => {
	return {
		settings,
	}
})

export const useFrontendStore = defineStore("frontend", () => {
	useTheme()
	return { currentLocale: useLocale() }
})

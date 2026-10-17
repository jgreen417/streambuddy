import { useLocale } from "@/composables/useLocale"
import { useTheme } from "@/composables/useTheme"
import { settings } from "./settings"

export const useOptionsStore = defineStore("options", () => {
	return {
		settings,
	}
})

export const useFrontendStore = defineStore("frontend", () => {
	const { isDark, toggleDark } = useTheme()
	const currentLocale = useLocale()
	return {
		isDark,
		toggleDark,
		currentLocale,
	}
})

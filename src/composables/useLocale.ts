import messages from "@intlify/unplugin-vue-i18n/messages"
import { watch } from "vue"
import { createI18n } from "vue-i18n"
import { useBrowserLocalStorage } from "./useBrowserStorage"

export const i18n = createI18n({
	globalInjection: true,
	legacy: false,
	locale: "en",
	fallbackLocale: "en",
	messages,
})

// restore locale from local storage
const { data: savedLocale } = useBrowserLocalStorage<string>("user-locale", "en")
i18n.global.locale.value = savedLocale.value

export function useLocale() {
	let defaultLocale = "en"
	const localeKey = "user-locale"
	browser.storage.local.get(localeKey).then(async (result) => {
		if (result?.[localeKey] == undefined) {
			// browser lang
			// locale files are named like zh_CN, so try the full tag before the bare language
			const tag = navigator.language.replace("-", "_")
			const lang = tag.split("_")[0]
			defaultLocale = [tag, lang].find((l) => i18n.global.availableLocales.includes(l)) ?? defaultLocale
			i18n.global.locale.value = defaultLocale
		}
	})

	// Use the useBrowserLocalStorage composable to persist the locale
	const { data: currentLocale } = useBrowserLocalStorage<string>(localeKey, defaultLocale, false)

	// Initialize the locale from i18n
	// currentLocale.value = i18n.global.locale.value

	// Watch for changes in the locale and update i18n
	watch(currentLocale, (newLocale) => {
		i18n.global.locale.value = newLocale
	})

	return currentLocale
}

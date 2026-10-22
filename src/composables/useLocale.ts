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
			// locale files are named like zh_CN, so try language_region, then the bare language,
			// then the likeliest region (zh and zh-Hans have none of their own but mean zh_CN)
			const locale = new Intl.Locale(navigator.language)
			const likely = locale.maximize()
			const candidates = [`${locale.language}_${locale.region}`, locale.language, `${likely.language}_${likely.region}`]
			defaultLocale = candidates.find((l) => i18n.global.availableLocales.includes(l)) ?? defaultLocale
			i18n.global.locale.value = defaultLocale
		}
	})

	// Use the useBrowserLocalStorage composable to persist the locale
	const { data: currentLocale } = useBrowserLocalStorage<string>(localeKey, defaultLocale, false)

	// Watch for changes in the locale and update i18n
	watch(currentLocale, (newLocale) => {
		i18n.global.locale.value = newLocale
	})

	return currentLocale
}

import { computed, ref } from "vue"
import {
	getAccount,
	isBuiltInKeyRejected,
	onAccountChanged,
	onBuiltInKeyRejectedChanged,
	type Account,
} from "@/utils/account"

// shared by the popup and the settings pages: the user's Letterboxd username and TMDb key
const account = ref<Account | null>(null)
getAccount().then((value) => {
	account.value = value
})
onAccountChanged((value) => {
	account.value = value
})
// the shared key stopped working and the user has none of their own
const keyRejected = ref(false)
isBuiltInKeyRejected()
	.then((value) => (keyRejected.value = value))
	.catch(() => {})
onBuiltInKeyRejectedChanged((value) => (keyRejected.value = value))

export function useAccount() {
	return {
		account,
		loaded: computed(() => account.value !== null),
		username: computed(() => account.value?.letterboxdUsername ?? ""),
		needsSetup: computed(() => account.value !== null && !account.value.tmdbToken),
		ratingsPaused: computed(() => keyRejected.value && !account.value?.ownTmdbToken),
	}
}

import { computed, ref } from "vue"
import { getAccount, onAccountChanged, type Account } from "@/utils/account"

// shared by the popup and the settings pages: the user's own Letterboxd username and TMDb key
const account = ref<Account | null>(null)
getAccount().then((value) => {
	account.value = value
})
onAccountChanged((value) => {
	account.value = value
})

export function useAccount() {
	return {
		account,
		loaded: computed(() => account.value !== null),
		username: computed(() => account.value?.letterboxdUsername ?? ""),
		needsSetup: computed(() => account.value !== null && !account.value.tmdbToken),
	}
}

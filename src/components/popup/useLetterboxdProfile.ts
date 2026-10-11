import { computed, ref } from "vue"
import { sendMessage } from "webext-bridge/popup"
import { getLetterboxdSlug, type LetterboxdProfile } from "@/utils/ratings"

// shared by both popup tabs: the synced Letterboxd diary/watchlist and a manual "sync now"
const profile = ref<LetterboxdProfile | null>(null)
const syncing = ref(false)
const loading = ref(true)
const error = ref("")
browser.storage.local
	.get("letterboxdProfile")
	.then((result) => {
		profile.value = (result.letterboxdProfile as LetterboxdProfile | undefined) ?? null
	})
	.catch(() => {
		error.value = "Could not load the saved profile. Try syncing again."
	})
	.finally(() => {
		loading.value = false
	})

async function sync() {
	if (syncing.value) return
	syncing.value = true
	error.value = ""
	try {
		const fresh = (await sendMessage("letterboxdProfile", { force: true }, "background")) as
			LetterboxdProfile | null | { error: string }
		if (!fresh || "error" in fresh || !fresh.watched || !Array.isArray(fresh.watchlist))
			throw new Error("Profile unavailable")
		profile.value = fresh
	} catch {
		error.value = "Could not sync Letterboxd. Your saved profile is unchanged. Try again."
	} finally {
		syncing.value = false
	}
}

function relativeTime(timestamp: number) {
	if (!timestamp) return "Refresh needed"
	const minutes = Math.round((Date.now() - timestamp) / 60000)
	if (minutes < 1) return "just now"
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.round(minutes / 60)
	return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export function useLetterboxdProfile() {
	const summary = computed(() => {
		if (!profile.value) return null
		return {
			logged: Object.keys(profile.value.watched).length,
			watchlist: profile.value.watchlist.length,
			syncedAgo: profile.value.fetchedAt ? `Synced ${relativeTime(profile.value.fetchedAt)}` : "Refresh needed",
		}
	})
	const hasWatched = (url: string) => {
		const slug = getLetterboxdSlug(url)
		return !!slug && !!profile.value && slug in profile.value.watched
	}
	return { profile, summary, loading, syncing, error, sync, hasWatched }
}

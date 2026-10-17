<script setup lang="ts">
import { ref } from "vue"
import { storeToRefs } from "pinia"
import { useOptionsStore } from "@/stores/options.store"
import { settingsReady } from "@/stores/settings"
import type { StreamingService } from "@/constants/streamingServices"
import ExperiencePreferences from "./ExperiencePreferences.vue"
import { useLetterboxdProfile } from "./useLetterboxdProfile"
import { useAccount } from "./useAccount"
const props = defineProps<{ service: StreamingService | null; expanded?: boolean; fixedService?: boolean }>()
const { settings } = storeToRefs(useOptionsStore())
const loaded = ref(false)
const loadError = ref(false)
settingsReady.then(() => {
	loaded.value = true
}).catch(() => {
	loadError.value = true
})
const { summary, loading, syncing, error, sync } = useLetterboxdProfile()
const { username } = useAccount()
</script>
<template>
	<div
		v-if="!loaded"
		class="sb-empty"
		role="status"
	>
		{{ loadError ? "Preferences could not load. Reopen this page to try again." : "Loading your preferences…" }}
	</div>
	<ExperiencePreferences
		v-else
		v-model:settings="settings"
		:service="props.service"
		:expanded="expanded"
		:fixed-service="fixedService"
	>
		<template #profile>
			<div
				v-if="username"
				class="sb-profile"
			>
				<p class="sb-help">
					Watched and friend data use {{ username }}’s public profile. Watchlist changes use the account signed in to
					Letterboxd.
				</p>
				<div
					class="sb-row-note"
					role="status"
					aria-live="polite"
				>
					<span v-if="loading">Loading profile…</span>
					<span v-else-if="syncing">Syncing profile…</span>
					<span v-else-if="summary">
						{{ summary.logged }} logged · {{ summary.watchlist }} watchlisted
						<br />
						{{ summary.syncedAgo }}
					</span>
					<span v-else>Profile hasn’t synced yet.</span>
					<button
						type="button"
						class="sb-link"
						:disabled="loading || syncing"
						@click="sync"
					>
						{{ syncing ? "Syncing…" : error ? "Retry sync" : "Sync now" }}
					</button>
				</div>
				<p
					v-if="error"
					class="sb-error"
					role="status"
				>
					{{ error }}
				</p>
			</div>
		</template>
	</ExperiencePreferences>
</template>

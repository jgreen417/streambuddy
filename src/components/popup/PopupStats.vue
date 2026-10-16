<script setup lang="ts">
import { SERVICE_NAMES_BY_STATS_KEY as PLATFORM_NAMES } from "@/constants/streamingServices"
import { computed, ref } from "vue"
import { storeToRefs } from "pinia"
import { useOptionsStore, SettingsPromise } from "@/stores/options.store"
import { getScoreColor } from "@/utils/ratings"
import { color, serviceColors } from "@/design/tokens"
import { useLetterboxdProfile } from "./useLetterboxdProfile"
import {
	formatDuration,
	getRatingPercentile,
	summarizeWatchLog,
	recentSeenTitles,
	sumLastDays,
	type SavedLog,
	type SeenTop,
	type WatchLog,
} from "@/utils/stats"

const { settings } = storeToRefs(useOptionsStore())
const watchLog = ref<WatchLog>({})
const seenTop = ref<SeenTop>({})
const watchlistSeen = ref<SeenTop>({})
const savedLog = ref<SavedLog>({})
const loading = ref(true)
const error = ref(false)
const settingsFailed = ref(false)
async function loadStats() {
	loading.value = true
	error.value = false
	try {
		try {
			await SettingsPromise
		} catch {
			settingsFailed.value = true
			throw new Error("Settings unavailable")
		}
		const result = await browser.storage.local.get(["watchLog", "seenTop", "watchlistSeen", "savedLog"])
		savedLog.value = (result.savedLog as SavedLog) ?? {}
		watchLog.value = (result.watchLog as WatchLog) ?? {}
		seenTop.value = (result.seenTop as SeenTop) ?? {}
		watchlistSeen.value = (result.watchlistSeen as SeenTop) ?? {}
	} catch {
		error.value = true
	} finally {
		loading.value = false
	}
}
loadStats()
const { hasWatched } = useLetterboxdProfile()

const summary = computed(() => summarizeWatchLog(watchLog.value, new Date()))
const maxDay = computed(() => Math.max(...summary.value.days.map((day) => day.seconds), 1))
const weekDelta = computed(() => summary.value.thisWeek - summary.value.lastWeek)
const servicesTotal = computed(() => summary.value.byService.reduce((sum, service) => sum + service.seconds, 0))

// intros, recaps, credits and ads skipped in the last 7 days
const timeSaved = computed(() => sumLastDays(savedLog.value, new Date(), 7))

// films logged since they were spotted aren't recommendations any more
const topUnwatched = (titles: SeenTop, count: number) =>
	recentSeenTitles(titles, new Date())
		.filter((title) => !hasWatched(title.url))
		.sort((a, b) => getRatingPercentile(b.source, b.rating) - getRatingPercentile(a.source, a.rating))
		.slice(0, count)
// two of each when both lists show, so the popup stays within the browser's 600px limit
const watchlistTitles = computed(() => topUnwatched(watchlistSeen.value, 2))
const bestTitles = computed(() =>
	topUnwatched(seenTop.value, 5)
		.filter((title) => !watchlistTitles.value.some((watchlist) => watchlist.title === title.title))
		.slice(0, watchlistTitles.value.length ? 2 : 3),
)
const formatRating = (title: { source: string; rating: number }) =>
	title.source === "letterboxd" ? `Letterboxd ${title.rating.toFixed(2)}/5` : `IMDb ${title.rating.toFixed(1)}/10`
</script>

<template>
	<div
		v-if="loading"
		class="sb-empty"
		role="status"
	>
		Loading your viewing history…
	</div>
	<div
		v-else-if="error"
		class="sb-empty"
		role="status"
	>
		{{
			settingsFailed
				? "Settings could not load. Close and reopen this page to try again."
				: "Viewing history could not load."
		}}
		<button
			v-if="!settingsFailed"
			class="sb-link"
			type="button"
			@click="loadStats"
		>
			Try again
		</button>
	</div>
	<template v-else>
		<div class="sb-big">{{ formatDuration(summary.thisWeek) }}</div>
		<div class="sb-sub">
			watched in the last 7 days
			<template v-if="summary.lastWeek > 0 || summary.thisWeek > 0">
				·
				<span :class="{ 'is-up': weekDelta > 0 }">
					{{ weekDelta >= 0 ? "+" : "−" }}{{ formatDuration(Math.abs(weekDelta)) }}
				</span>
				vs. the previous 7 days
			</template>
			<template v-else>· counts while a video plays</template>
		</div>
		<div
			class="sb-bars"
			role="img"
			:aria-label="summary.days.map((day) => `${day.label}: ${formatDuration(day.seconds)}`).join('; ')"
		>
			<span
				v-for="day in summary.days"
				:key="day.label"
				:class="{ 'is-today': day.isToday }"
				:style="{ height: (day.seconds / maxDay) * 100 + '%' }"
				:title="formatDuration(day.seconds)"
			></span>
		</div>
		<div
			class="sb-days"
			aria-hidden="true"
		>
			<span
				v-for="day in summary.days"
				:key="day.label"
			>
				{{ day.label }}
			</span>
		</div>
		<template v-if="summary.byService.length">
			<div class="sb-split">
				<span
					v-for="service in summary.byService"
					:key="service.platform"
					:style="{ flex: service.seconds, background: serviceColors[service.platform] ?? color.textMuted }"
				></span>
			</div>
			<div class="sb-legend">
				<span
					v-for="service in summary.byService"
					:key="service.platform"
				>
					<i :style="{ background: serviceColors[service.platform] ?? color.textMuted }"></i>
					{{ PLATFORM_NAMES[service.platform] ?? service.platform }}
					{{ Math.round((service.seconds / servicesTotal) * 100) }}%
				</span>
			</div>
		</template>

		<div class="sb-tiles">
			<div class="sb-tile">
				<div class="sb-tile-value">{{ formatDuration(timeSaved) }}</div>
				<div class="sb-tile-label">saved by skipping this week</div>
			</div>
			<div class="sb-tile">
				<template v-if="summary.biggestNight">
					<div class="sb-tile-value">{{ summary.biggestNight.weekday }}</div>
					<div class="sb-tile-label">biggest night · {{ formatDuration(summary.biggestNight.averageSeconds) }}</div>
				</template>
				<template v-else>
					<div class="sb-tile-value">–</div>
					<div class="sb-tile-label">Not enough viewing data yet</div>
				</template>
			</div>
		</div>

		<template v-if="watchlistTitles.length">
			<div class="sb-label">From your watchlist, spotted recently</div>
			<div class="sb-group">
				<a
					v-for="title in watchlistTitles"
					:key="title.title"
					class="sb-title-row"
					:href="title.url"
					target="_blank"
					rel="noopener noreferrer"
				>
					<div style="min-width: 0">
						<div class="sb-title-name">{{ title.title }}</div>
						<div class="sb-title-meta">{{ PLATFORM_NAMES[title.platform] ?? title.platform }} · opens Letterboxd</div>
					</div>
					<span
						class="sb-pill"
						:style="{ background: getScoreColor(title.source, title.rating) }"
					>
						{{ formatRating(title) }}
					</span>
				</a>
			</div>
		</template>

		<div class="sb-label">Highly rated titles you spotted</div>
		<div class="sb-group">
			<a
				v-for="title in bestTitles"
				:key="title.title"
				class="sb-title-row"
				:href="title.url"
				target="_blank"
				rel="noopener noreferrer"
			>
				<div style="min-width: 0">
					<div class="sb-title-name">{{ title.title }}</div>
					<div class="sb-title-meta">
						{{ PLATFORM_NAMES[title.platform] ?? title.platform }} ·
						{{ title.media_type === "tv" ? "series" : "film" }} · opens
						{{ title.source === "letterboxd" ? "Letterboxd" : "IMDb" }}
					</div>
				</div>
				<span
					class="sb-pill"
					:style="{ background: getScoreColor(title.source, title.rating) }"
				>
					{{ formatRating(title) }}
				</span>
			</a>
			<div
				v-if="!bestTitles.length"
				class="sb-empty"
			>
				Browse a streaming homepage and the best-rated titles you scroll past will show up here.
			</div>
		</div>
	</template>
</template>

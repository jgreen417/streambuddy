<script setup lang="ts">
import { computed, ref, watch, useId } from "vue"
import type { FriendsStyle, RatingSources, settingsType } from "@/stores/storeTypes"
import { SERVICES, streamingServices, type StreamingService } from "@/constants/streamingServices"
import { getServiceState, setServiceState, getRatingMode, setRatingMode, type RatingMode } from "@/utils/preferences"
import { RATING_SOURCES, usesSource } from "@/utils/rating-sources"
import PopupToggle from "./PopupToggle.vue"
import { useAccount } from "./useAccount"
const settings = defineModel<settingsType>("settings", { required: true })
const props = defineProps<{
	service: StreamingService | null
	expanded?: boolean
	fixedService?: boolean
}>()
const selection = ref<StreamingService | "">(props.service ?? "")
watch(
	() => props.service,
	(value) => {
		selection.value = value ?? ""
	},
)
const targets = computed(() => (selection.value ? [selection.value] : [...streamingServices]))
const scope = computed(() => (selection.value ? SERVICES[selection.value].name : "All services"))
const has = (key: string) =>
	targets.value.some((service) => typeof (settings.value[service] as Record<string, unknown>)[key] === "boolean")
function preference(keys: string[]) {
	return computed({
		get: () => getServiceState(settings.value, targets.value, keys),
		set: (value) => setServiceState(settings.value, targets.value, keys, value === true),
	})
}
const cards = preference(["showRating"])
const intros = preference(["skipIntro", "skipRecap"])
const introOnly = preference(["skipIntro"])
const recaps = preference(["skipRecap"])
const credits = preference(["skipCredits"])
const stillWatching = preference(["skipStillWatching"])
const ads = preference(["skipAd"])
const speed = preference(["speedControl"])
const skipDelayOptions = [
	{ value: 0, label: "No wait" },
	{ value: 1, label: "1 second" },
	{ value: 2, label: "2 seconds" },
]
const pauseOptions = [
	{ value: 0, label: "Never" },
	{ value: 2, label: "After 2 episodes" },
	{ value: 3, label: "After 3 episodes" },
	{ value: 4, label: "After 4 episodes" },
	{ value: 6, label: "After 6 episodes" },
]
const sourceOptions: { value: RatingSources; label: string }[] = [
	{ value: "both", label: "Letterboxd & IMDb" },
	{ value: "letterboxd", label: "Letterboxd only" },
	{ value: "imdb", label: "IMDb only" },
	{ value: "tmdb", label: "TMDb only" },
]
const badgeLooks = [
	{ value: "classic", label: "Classic" },
	{ value: "glass", label: "Liquid Glass" },
] as const
const sourceLabel = computed(
	() => sourceOptions.find((option) => option.value === settings.value.General.ratingSources)?.label ?? "",
)
const letterboxdOff = computed(() => !usesSource(settings.value.General.ratingSources, "letterboxd"))
// one picker for whether friends' ratings show and how: "hidden" turns them off (and stops fetching them)
const friendsOptions: { value: FriendsStyle | "hidden"; label: string }[] = [
	{ value: "labels", label: "Labelled" },
	{ value: "dots", label: "Dot per friend" },
	{ value: "trio", label: "Three dots" },
	{ value: "hidden", label: "Hidden" },
]
const friendsDisplay = computed({
	get: () => (settings.value.General.friendsRatings ? settings.value.General.friendsStyle : "hidden"),
	set: (value: FriendsStyle | "hidden") => {
		settings.value.General.friendsRatings = value !== "hidden"
		if (value !== "hidden") settings.value.General.friendsStyle = value
	},
})
const cardsInactive = computed(() => cards.value !== true)
const cardDependency = computed(() =>
	cardsInactive.value ? "Turn on card ratings for the selected services." : undefined,
)
const mode = computed({
	get: () => getRatingMode(settings.value, true),
	set: (value) => setRatingMode(settings.value, value, true),
})
const id = useId()
const { letterboxd, imdb } = RATING_SOURCES
const bands = letterboxd.bands.map((score, index) => ({
	value: index + 1,
	label: `${letterboxd.name} ${score.toFixed(1)}/${letterboxd.max} · ${imdb.name} ${imdb.bands[index].toFixed(1)}/${imdb.max}`,
}))
const { username } = useAccount()
function openAccount() {
	browser.tabs.create({ url: browser.runtime.getURL("src/ui/options-page/index.html#/options-page/Account") })
}
const updateMode = (event: Event) => {
	mode.value = (event.target as HTMLInputElement).value as RatingMode
}
</script>
<template>
	<div class="sb-preferences">
		<label
			v-if="!fixedService"
			class="sb-scope"
			:for="`${id}-scope`"
		>
			<span>Service preferences</span>
			<select
				:id="`${id}-scope`"
				v-model="selection"
			>
				<option value="">All services</option>
				<option
					v-for="service in streamingServices"
					:key="service"
					:value="service"
				>
					{{ SERVICES[service].name }}
				</option>
			</select>
		</label>
		<p
			v-if="fixedService"
			class="sb-scope"
		>
			Service preferences: {{ scope }}
		</p>
		<p class="sb-help sb-scope-note">Playback &amp; cards: {{ scope }}. Others are global.</p>
		<div class="sb-label">Quick controls</div>
		<div class="sb-group">
			<PopupToggle
				:model-value="intros === true"
				:mixed="intros === 'mixed'"
				:label="has('skipRecap') ? 'Skip intros & recaps' : 'Skip intros'"
				@update:model-value="intros = $event"
			/>
			<PopupToggle
				v-if="has('skipAd')"
				:model-value="ads === true"
				:mixed="ads === 'mixed'"
				label="Skip ads"
				@update:model-value="ads = $event"
			/>
			<PopupToggle
				v-if="has('showRating')"
				:model-value="cards === true"
				:mixed="cards === 'mixed'"
				label="Ratings on title cards"
				@update:model-value="cards = $event"
			/>
		</div>
		<div class="sb-label">Badge look</div>
		<div class="sb-group sb-badge-look">
			<div
				class="sb-mode sb-look-picker"
				role="radiogroup"
				aria-label="Badge look"
			>
				<label
					v-for="look in badgeLooks"
					:key="look.value"
				>
					<input
						v-model="settings.General.badgeStyle"
						type="radio"
						:name="`${id}-look`"
						:value="look.value"
					/>
					<span>
						<i
							class="sb-look-sample"
							:class="look.value"
							aria-hidden="true"
						>
							<b>4.1</b>
						</i>
						{{ look.label }}
					</span>
				</label>
			</div>
			<label
				v-if="settings.General.badgeStyle === 'glass'"
				class="sb-cutoff sb-frost"
			>
				Glass:
				{{ settings.General.glassFrost < 34 ? "clear" : settings.General.glassFrost < 67 ? "soft frost" : "frosted" }}
				<input
					v-model.number="settings.General.glassFrost"
					type="range"
					min="0"
					max="100"
					step="5"
					:aria-valuetext="`${settings.General.glassFrost}% frosted`"
				/>
			</label>
			<p class="sb-help">Applies to card and episode ratings.</p>
			<label class="sb-cutoff">
				Badge detail
				<select v-model="settings.General.badgeDetail">
					<option value="full">Full</option>
					<option value="score">Score only</option>
				</select>
			</label>
			<p class="sb-help">Score only keeps the score and its source; friends and your status stay in the tooltip.</p>
		</div>
		<details
			class="sb-disclosure"
			:open="expanded"
		>
			<summary>
				<span>
					Ratings & discovery
					<small>{{ cardsInactive ? "Card effects paused" : `${sourceLabel} · Low ratings: ${mode}` }}</small>
				</span>
			</summary>
			<div class="sb-disclosure-body">
				<p class="sb-help">Title pages, episodes and search work on Netflix, HBO Max, Prime Video and Disney+.</p>
				<label class="sb-cutoff">
					Ratings from
					<select v-model="settings.General.ratingSources">
						<option
							v-for="option in sourceOptions"
							:key="option.value"
							:value="option.value"
						>
							{{ option.label }}
						</option>
					</select>
				</label>
				<p class="sb-help">TMDb fills in when the chosen sites have no rating.</p>
				<PopupToggle
					v-model="settings.General.episodeRatings"
					label="Episode ratings"
					description="IMDb scores beside individual episodes."
				/>
				<PopupToggle
					v-model="settings.General.searchSort"
					label="Search sort button"
					description="Choose rating order on a search page."
				/>
				<fieldset
					class="sb-filter"
					:disabled="cardsInactive"
				>
					<legend>Low-rated titles</legend>
					<p
						v-if="cardDependency"
						class="sb-help"
					>
						{{ cardDependency }}
					</p>
					<div class="sb-mode">
						<label
							v-for="option in ['off', 'dim', 'hide']"
							:key="option"
						>
							<input
								type="radio"
								:name="`${id}-mode`"
								:value="option"
								:checked="mode === option"
								@change="updateMode"
							/>
							<span>{{ option === "off" ? "Off" : option === "dim" ? "Dim" : "Hide" }}</span>
						</label>
					</div>
					<label
						v-if="mode !== 'off'"
						class="sb-cutoff"
					>
						Below
						<select v-model.number="settings.General.dimBelowBand">
							<option
								v-for="band in bands"
								:key="band.value"
								:value="band.value"
							>
								{{ band.label }}
							</option>
						</select>
					</label>
					<p class="sb-help">Unrated titles stay visible.</p>
				</fieldset>
			</div>
		</details>
		<details
			class="sb-disclosure"
			:open="expanded"
		>
			<summary>
				<span>
					Letterboxd
					<small>{{ username ? `Profile: ${username}` : "Personal ratings & watchlist" }}</small>
				</span>
			</summary>
			<div class="sb-disclosure-body">
				<slot name="profile" />
				<template v-if="username">
					<label class="sb-cutoff">
						Friends’ ratings
						<select
							v-model="friendsDisplay"
							:disabled="letterboxdOff"
						>
							<option
								v-for="option in friendsOptions"
								:key="option.value"
								:value="option.value"
							>
								{{ option.label }}
							</option>
						</select>
					</label>
					<p
						v-if="letterboxdOff"
						class="sb-help"
					>
						Friends’ ratings need Letterboxd in “Ratings from”.
					</p>
					<PopupToggle
						v-model="settings.General.markWatched"
						label="Seen & watchlist card marks"
						:disabled="cardsInactive"
						:description="cardDependency"
					/>
					<PopupToggle
						v-model="settings.General.fadeWatched"
						label="Fade watched films"
						:disabled="cardsInactive"
						:description="cardDependency"
					/>
					<PopupToggle
						v-model="settings.General.rateOnCredits"
						label="Rating prompt near the end"
						description="Opens Letterboxd during a film’s final 90 seconds."
					/>
				</template>
				<p
					v-else
					class="sb-help"
				>
					Add your Letterboxd username to see friends’ ratings and mark films you’ve seen.
					<button
						type="button"
						class="sb-link"
						@click="openAccount"
					>
						Add username
					</button>
				</p>
			</div>
		</details>
		<details
			class="sb-disclosure"
			:open="expanded"
		>
			<summary>
				<span>
					Playback preferences
					<small>
						{{
							credits === "mixed" ? "Episode advance: mixed" : credits ? "Episode advance on" : "Episode advance off"
						}}
					</small>
				</span>
			</summary>
			<div class="sb-disclosure-body">
				<PopupToggle
					:model-value="introOnly === true"
					:mixed="introOnly === 'mixed'"
					label="Skip intros"
					@update:model-value="introOnly = $event"
				/>
				<PopupToggle
					v-if="has('skipRecap')"
					:model-value="recaps === true"
					:mixed="recaps === 'mixed'"
					label="Skip recaps"
					@update:model-value="recaps = $event"
				/>
				<PopupToggle
					v-if="has('skipCredits')"
					:model-value="credits === true"
					:mixed="credits === 'mixed'"
					label="Advance to the next episode"
					description="Uses the service’s next-episode control when it appears."
					@update:model-value="credits = $event"
				/>
				<PopupToggle
					:model-value="stillWatching === true"
					:mixed="stillWatching === 'mixed'"
					label="Answer “Still watching?”"
					@update:model-value="stillWatching = $event"
				/>
				<PopupToggle
					:model-value="speed === true"
					:mixed="speed === 'mixed'"
					label="Speed control"
					description="Remembers your speed per service. Shift + < or > to adjust; Prime Video, HBO Max and Disney+ also get a speed pill."
					@update:model-value="speed = $event"
				/>
				<PopupToggle
					v-model="settings.General.keepFirstIntro"
					label="Play intros on episode 1"
					description="Hear the theme once, then skip it."
				/>
				<PopupToggle
					v-if="has('skipRecap')"
					v-model="settings.General.keepSeasonRecaps"
					label="Keep recaps on episode 1"
					description="Hear the “previously on” when a new season begins."
				/>
				<PopupToggle
					v-model="settings.General.skipNotices"
					label="Skip notices"
					description="A short notice with Undo each time something is skipped."
				/>
				<label class="sb-cutoff">
					Wait before skipping
					<select v-model.number="settings.General.skipDelaySeconds">
						<option
							v-for="option in skipDelayOptions"
							:key="option.value"
							:value="option.value"
						>
							{{ option.label }}
						</option>
					</select>
				</label>
				<label class="sb-cutoff">
					Pause autoplay
					<select v-model.number="settings.General.pauseAfter">
						<option
							v-for="option in pauseOptions"
							:key="option.value"
							:value="option.value"
						>
							{{ option.label }}
						</option>
					</select>
				</label>
				<p class="sb-help">Counts episodes that play in a row while you don’t touch anything.</p>
			</div>
		</details>
	</div>
</template>

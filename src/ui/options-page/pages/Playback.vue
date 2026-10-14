<script setup lang="ts">
import { computed, ref } from "vue"
import { loadRules, onRulesChanged, saveRules, withoutException } from "@/playback/rules"
import { SKIP_LABELS, type SkipKind, type SkipRules } from "@/playback/types"

const rules = ref<SkipRules>({})
loadRules().then((value) => (rules.value = value))
onRulesChanged((value) => (rules.value = value))

const entries = computed(() =>
	Object.entries(rules.value)
		.flatMap(([show, kinds]) => kinds.map((kind) => ({ show, kind })))
		.sort((a, b) => a.show.localeCompare(b.show)),
)
const titleCase = (key: string) => key.replace(/\b\w/g, (letter) => letter.toUpperCase())

async function remove(show: string, kind: SkipKind) {
	rules.value = withoutException(rules.value, show, kind)
	await saveRules(rules.value)
}
</script>

<template>
	<h1>Playback</h1>
	<p class="description">
		streamBuddy skips intros, recaps and credits, passes ads, keeps your speed and can pause long autoplay runs on
		Netflix, Prime Video and HBO Max. Switch each one on or off in
		<RouterLink to="/options-page/Experience">Viewing preferences</RouterLink>
		.
	</p>

	<h2>Shows you don’t skip</h2>
	<p class="description">
		When a skip notice appears, choose “Not for this show” to keep that part playing. Those exceptions are listed here.
	</p>
	<ul
		v-if="entries.length"
		class="sb-rules"
	>
		<li
			v-for="entry in entries"
			:key="`${entry.show}|${entry.kind}`"
		>
			<span>
				<strong>{{ titleCase(entry.show) }}</strong>
				plays its {{ SKIP_LABELS[entry.kind] }}
			</span>
			<button
				type="button"
				:aria-label="`Skip the ${SKIP_LABELS[entry.kind]} of ${titleCase(entry.show)} again`"
				@click="remove(entry.show, entry.kind)"
			>
				Skip again
			</button>
		</li>
	</ul>
	<p
		v-else
		class="sb-empty"
	>
		No exceptions yet.
	</p>

	<h2>Keyboard</h2>
	<table class="sb-keys">
		<tbody>
			<tr>
				<td>
					<kbd>Shift</kbd>
					+
					<kbd>&gt;</kbd>
				</td>
				<td>Faster (0.25× steps, up to 4×)</td>
			</tr>
			<tr>
				<td>
					<kbd>Shift</kbd>
					+
					<kbd>&lt;</kbd>
				</td>
				<td>Slower</td>
			</tr>
		</tbody>
	</table>
	<p class="description">
		Your speed is remembered for each service, and comes back after ads and on the next episode.
	</p>
</template>

<style scoped>
h2 {
	margin: 28px 0 6px;
}
.sb-rules {
	list-style: none;
	padding: 0;
	margin: 12px 0 0;
	max-width: 620px;
	display: grid;
	gap: 6px;
}
.sb-rules li {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 12px;
	border-radius: 10px;
	background: rgba(251, 244, 236, 0.04);
	border: 1px solid rgba(251, 244, 236, 0.08);
}
.sb-rules strong {
	color: #fbf4ec;
	font-weight: 600;
}
.sb-rules button {
	padding: 5px 12px;
	border-radius: 999px;
	border: 1px solid rgba(251, 244, 236, 0.12);
	background: rgba(251, 244, 236, 0.06);
	color: #fbf4ec;
	font-size: 13px;
	cursor: pointer;
}
.sb-rules button:hover {
	background: rgba(251, 244, 236, 0.12);
}
.sb-empty {
	color: #a39b93;
}
kbd {
	padding: 1px 6px;
	border-radius: 4px;
	border: 1px solid rgba(251, 244, 236, 0.18);
	background: rgba(251, 244, 236, 0.06);
	font:
		600 12px/1.6 ui-monospace,
		SFMono-Regular,
		Menlo,
		monospace;
}
.sb-keys td {
	padding: 6px 16px 6px 0;
	border: 0 !important;
}
</style>

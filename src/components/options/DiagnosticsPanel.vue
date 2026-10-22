<script setup lang="ts">
import { onMounted, ref } from "vue"
import { diagnosticsReport, formatBytes, summarize, type DiagnosticsSummary } from "@/utils/diagnostics"

const version = __VERSION__
const browserName = browser.runtime.getURL("").startsWith("moz-extension:") ? "Firefox" : "Chrome"
const summary = ref<DiagnosticsSummary | null>(null)
const status = ref("")
const busy = ref(false)

async function load() {
	summary.value = summarize(
		await browser.storage.local.get(["DBCache", "letterboxdProfile", "titleOverrides", "watchLog", "savedLog"]),
	)
}
onMounted(load)

async function copyReport() {
	if (!summary.value) return
	try {
		await navigator.clipboard.writeText(diagnosticsReport(summary.value, { version, browser: browserName }))
		status.value = "Diagnostics copied. It contains counts, not your titles."
	} catch {
		status.value = "The clipboard was unavailable. Try again from a focused tab."
	}
}

async function clearCache() {
	if (!confirm("Clear the cached ratings? They will be looked up again as you browse.")) return
	busy.value = true
	try {
		await browser.storage.local.remove("DBCache")
		await load()
		status.value = "Rating cache cleared. Open streaming tabs will refresh their badges."
	} finally {
		busy.value = false
	}
}

async function clearOverrides() {
	if (!confirm("Clear every fixed title match? Cards will go back to the automatic match.")) return
	busy.value = true
	try {
		// the corrected matches are cached under the card titles too, so they go first or the cards would keep them
		const stored = await browser.storage.local.get(["DBCache", "titleOverrides"])
		const fixed = new Set(
			Object.values((stored.titleOverrides ?? {}) as Record<string, { id: number }>).map((fix) => fix.id),
		)
		const cache = Object.entries((stored.DBCache ?? {}) as Record<string, { id?: number }>)
		await browser.storage.local.set({
			DBCache: Object.fromEntries(cache.filter(([, entry]) => entry.id === undefined || !fixed.has(entry.id))),
		})
		await browser.storage.local.remove("titleOverrides")
		await load()
		status.value = "Fixed titles cleared."
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<section class="diagnostics">
		<h2>Diagnostics</h2>
		<p class="description">Everything here is read from this browser. Nothing is sent anywhere.</p>
		<div class="sb sb-preferences-full">
			<div
				v-if="summary"
				class="sb-group"
			>
				<div class="diag-row">
					<span class="k">
						Rating cache
						<small>Letterboxd, IMDb and TMDb results kept on this device</small>
					</span>
					<span class="v">{{ summary.cacheTitles }} titles · {{ formatBytes(summary.cacheBytes) }}</span>
				</div>
				<div class="diag-row">
					<span class="k">
						Letterboxd profile
						<small>{{ summary.profileFilms }} films · {{ summary.profileWatchlist }} watchlisted</small>
					</span>
					<span class="v">{{ summary.profileSynced }}</span>
				</div>
				<div class="diag-row">
					<span class="k">
						Fixed title matches
						<small>Corrections you made in the card inspector</small>
					</span>
					<span class="v">{{ summary.fixedTitles }}</span>
				</div>
				<div class="diag-row">
					<span class="k">
						Watch history
						<small>{{ summary.watchDays }} days recorded locally</small>
					</span>
					<span class="v">{{ Math.round(summary.savedSeconds / 60) }} min saved by skipping</span>
				</div>
				<div class="diag-row">
					<span class="k">
						Build
						<small>No telemetry, no developer server</small>
					</span>
					<span class="v">v{{ version }} · {{ browserName }}</span>
				</div>
			</div>
			<p
				v-else
				class="sb-empty"
				role="status"
			>
				Reading local storage…
			</p>
			<div class="diag-actions">
				<button
					type="button"
					class="diag-button"
					:disabled="!summary"
					@click="copyReport"
				>
					Copy diagnostics
				</button>
				<button
					type="button"
					class="diag-button"
					:disabled="busy"
					@click="clearCache"
				>
					Clear rating cache
				</button>
				<button
					type="button"
					class="diag-button danger"
					:disabled="busy || !summary?.fixedTitles"
					@click="clearOverrides"
				>
					Clear fixed titles
				</button>
			</div>
			<p
				class="sb-help"
				role="status"
				aria-live="polite"
			>
				{{ status }}
			</p>
		</div>
	</section>
</template>

<style scoped>
.diagnostics {
	margin-top: 42px;
}
.diag-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 18px;
	padding: 11px 12px;
	border-top: 1px solid var(--sb-hairline);
	font-size: 13px;
	line-height: 1.35;
}
.diag-row:first-child {
	border-top: 0;
}
.diag-row .k small {
	display: block;
	margin-top: 2px;
	color: var(--sb-text-muted);
	font-size: 11px;
}
.diag-row .v {
	color: var(--sb-text-muted);
	text-align: right;
}
.diag-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 12px;
}
.diag-button {
	min-height: 36px;
	padding: 0 13px;
	border: 1px solid var(--sb-line-solid);
	border-radius: 10px;
	background: transparent;
	color: var(--sb-text);
	font: 600 12px/1 var(--sb-font-ui);
	cursor: pointer;
}
.diag-button:hover:not(:disabled) {
	background: var(--sb-surface-raised);
}
.diag-button.danger {
	color: var(--sb-danger);
	border-color: var(--sb-danger);
}
.diag-button:disabled {
	cursor: default;
	opacity: 0.45;
}
</style>

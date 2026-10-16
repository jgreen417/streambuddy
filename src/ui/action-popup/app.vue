<script setup lang="ts">
import { computed, ref } from "vue"
import PopupSettings from "@/components/popup/PopupSettings.vue"
import PopupStats from "@/components/popup/PopupStats.vue"
import type { StreamingService } from "@/constants/streamingServices"
import { useAccount } from "@/components/popup/useAccount"
import { DONATE_URL } from "@/constants/links"

const SERVICES: Array<{ pattern: RegExp; service: StreamingService; name: string }> = [
	{ pattern: /(^|\.)(amazon|primevideo)\./i, service: "Amazon", name: "Prime Video" },
	{ pattern: /(^|\.)netflix\./i, service: "Netflix", name: "Netflix" },
	{ pattern: /(^|\.)(hbo)?max\.com$/i, service: "HBO", name: "HBO Max" },
]

const tab = ref<"settings" | "stats">("settings")
const { needsSetup, ratingsPaused } = useAccount()
const current = ref<(typeof SERVICES)[number] | null>(null)
// the activeTab permission lets us read the URL of the tab the popup was opened on
browser.tabs
	.query({ active: true, currentWindow: true })
	.then(([activeTab]) => {
		const hostname = activeTab?.url ? new URL(activeTab.url).hostname : ""
		current.value = SERVICES.find(({ pattern }) => pattern.test(hostname)) ?? null
	})
	.catch(() => {
		current.value = null
	})
const context = computed(() => (current.value ? current.value.name : "Choose your service below"))

function openSettings(route = "/options-page/Experience") {
	browser.tabs.create({ url: browser.runtime.getURL(`src/ui/options-page/index.html#${route}`) })
}
function navigateTabs(event: KeyboardEvent) {
	if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
	event.preventDefault()
	tab.value =
		event.key === "Home" ? "settings" : event.key === "End" ? "stats" : tab.value === "settings" ? "stats" : "settings"
	const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
	buttons[tab.value === "settings" ? 0 : 1]?.focus()
}
</script>

<template>
	<div class="sb">
		<header class="sb-header">
			<img
				src="@assets/logo.png"
				alt=""
			/>
			<div>
				<div class="sb-wordmark">
					<span>stream</span>
					<span>Buddy</span>
				</div>
				<div
					class="sb-context"
					:class="{ 'is-active': current }"
				>
					<i></i>
					{{ context }}
				</div>
			</div>
			<button
				type="button"
				class="sb-icon-button"
				aria-label="All settings"
				title="All settings"
				@click="openSettings()"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle
						cx="12"
						cy="12"
						r="3"
					/>
					<path
						d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
					/>
				</svg>
			</button>
		</header>

		<button
			v-if="needsSetup || ratingsPaused"
			type="button"
			class="sb-setup-banner"
			@click="openSettings('/options-page/install')"
		>
			<span v-if="ratingsPaused">
				<strong>Ratings are paused</strong>
				TMDb stopped accepting streamBuddy’s shared key. Add your own free key to turn ratings back on.
			</span>
			<span v-else>
				<strong>Finish setup to see ratings</strong>
				Add your free TMDb key. It takes two minutes.
			</span>
			<span aria-hidden="true">→</span>
		</button>
		<nav
			class="sb-tabs"
			role="tablist"
			aria-label="streamBuddy"
			@keydown="navigateTabs"
			:data-tab="tab"
		>
			<button
				type="button"
				role="tab"
				:aria-selected="tab === 'settings'"
				id="sb-settings-tab"
				aria-controls="sb-settings-panel"
				:tabindex="tab === 'settings' ? 0 : -1"
				:class="{ 'is-active': tab === 'settings' }"
				@click="tab = 'settings'"
			>
				Settings
			</button>
			<button
				type="button"
				role="tab"
				:aria-selected="tab === 'stats'"
				id="sb-stats-tab"
				aria-controls="sb-stats-panel"
				:tabindex="tab === 'stats' ? 0 : -1"
				:class="{ 'is-active': tab === 'stats' }"
				@click="tab = 'stats'"
			>
				Stats
			</button>
		</nav>

		<main class="sb-content">
			<section
				v-if="tab === 'settings'"
				id="sb-settings-panel"
				role="tabpanel"
				aria-labelledby="sb-settings-tab"
				tabindex="0"
			>
				<PopupSettings :service="current?.service ?? null" />
			</section>
			<section
				v-else
				id="sb-stats-panel"
				role="tabpanel"
				aria-labelledby="sb-stats-tab"
				tabindex="0"
			>
				<PopupStats />
			</section>
		</main>
		<footer class="sb-footer">
			<button
				type="button"
				@click="openSettings('/options-page/Playback')"
			>
				Playback & rules
			</button>
			<a
				v-if="DONATE_URL"
				:href="DONATE_URL"
				target="_blank"
				rel="noopener"
			>
				Support ♥
			</a>
			<button
				type="button"
				class="is-primary"
				@click="openSettings()"
			>
				All settings →
			</button>
		</footer>
	</div>
</template>

<style>
@import "@/assets/base.css";
@import "@/components/popup/popup.css";
</style>

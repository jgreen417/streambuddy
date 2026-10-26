<script setup lang="ts">
import { computed, ref } from "vue"
import { SERVICE_REQUEST_URL } from "@/constants/links"
import { SUPPORTED_SERVICE_NAMES, streamingServices } from "@/constants/streamingServices"
import { useBrowserLocalStorage } from "@/composables/useBrowserStorage"

// dismissing hides it until the next update
const version = __VERSION__
const { data: dismissedIn, promise } = useBrowserLocalStorage("serviceRequestDismissed", "")
// wait for storage so a dismissed banner doesn't flash in
const loaded = ref(false)
promise.then(() => (loaded.value = true))
const shown = computed(() => loaded.value && dismissedIn.value !== version)
</script>
<template>
	<aside
		v-if="shown"
		class="sb-request"
		aria-label="Request a streaming service"
	>
		<div class="sb-request-copy">
			<div class="sb-request-tag">Early days</div>
			<strong>streamBuddy works on {{ streamingServices.length }} services so far</strong>
			<p>{{ SUPPORTED_SERVICE_NAMES }}. Tell us which one you want next and we'll build the most requested.</p>
		</div>
		<a
			class="sb-request-button"
			:href="SERVICE_REQUEST_URL"
			target="_blank"
			rel="noopener"
		>
			Request a service
		</a>
		<button
			type="button"
			class="sb-request-close"
			aria-label="Hide until the next update"
			title="Hide until the next update"
			@click="dismissedIn = version"
		>
			×
		</button>
	</aside>
</template>
<style scoped>
.sb-request {
	position: relative;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--sb-space-xl);
	max-width: 660px;
	margin: 0 0 var(--sb-space-xl);
	padding: var(--sb-space-xl) 44px var(--sb-space-xl) 18px;
	border: 1px solid var(--sb-accent-line);
	border-radius: var(--sb-radius-xl);
	background: var(--sb-accent-wash);
}
.sb-request-copy {
	flex: 1 1 280px;
}
.sb-request-tag {
	color: var(--sb-accent);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
}
.sb-request strong {
	display: block;
	margin: var(--sb-space-xxs) 0;
	font-size: 15px;
}
.sb-request p {
	margin: 0;
	color: var(--sb-text-muted);
}
.sb-request-button {
	flex-shrink: 0;
	padding: 9px 14px;
	border-radius: var(--sb-radius-lg);
	background: var(--sb-accent);
	color: var(--sb-text-on-accent);
	font-weight: 700;
	text-decoration: none;
	white-space: nowrap;
}
.sb-request-button:hover {
	filter: brightness(1.08);
}
.sb-request-close {
	position: absolute;
	top: var(--sb-space-sm);
	right: var(--sb-space-md);
	padding: 0 var(--sb-space-xs);
	border: 0;
	background: none;
	color: var(--sb-text-muted);
	font-size: 18px;
	line-height: 1;
	cursor: pointer;
}
.sb-request-close:hover {
	color: var(--sb-text);
}
.sb-request :is(a, button):focus-visible {
	outline: 2px solid var(--sb-focus);
	outline-offset: 2px;
}
</style>

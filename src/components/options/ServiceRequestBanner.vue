<script setup lang="ts">
import { SERVICE_REQUEST_URL } from "@/constants/links"
import { SUPPORTED_SERVICE_NAMES, streamingServices } from "@/constants/streamingServices"
</script>
<template>
	<aside
		class="sb-request"
		aria-label="Request a streaming service"
	>
		<strong>Missing a service?</strong>
		<span :title="SUPPORTED_SERVICE_NAMES">streamBuddy covers {{ streamingServices.length }} so far.</span>
		<a
			:href="SERVICE_REQUEST_URL"
			target="_blank"
			rel="noopener"
		>
			Request one →
		</a>
	</aside>
</template>
<style scoped>
/* a quiet note under the settings menu, always there and never in the way */
.sb-request {
	display: flex;
	flex-direction: column;
	gap: var(--sb-space-xxs);
	margin: var(--sb-space-xl) var(--sb-space-lg) 0;
	padding: var(--sb-space-lg);
	border-radius: var(--sb-radius-lg);
	background: var(--sb-surface-sunken);
	color: var(--sb-text-muted);
	font-size: 12px;
	line-height: 1.4;
}
.sb-request strong {
	color: var(--sb-text);
	font-weight: 600;
}
.sb-request a {
	margin-top: var(--sb-space-xs);
	color: var(--sb-accent);
	font-weight: 600;
	text-decoration: none;
}
.sb-request a:hover {
	text-decoration: underline;
}
.sb-request a:focus-visible {
	outline: 2px solid var(--sb-focus);
	outline-offset: 2px;
}
</style>

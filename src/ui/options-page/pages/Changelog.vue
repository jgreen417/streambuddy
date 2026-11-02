<script setup lang="ts">
import { marked } from "marked"
import { reviewsUrl, saveRateAsk, storeName } from "@/utils/rate-ask"

// the page's own heading, like the other pages; each release is a section under it
const changelog = marked.parse(__CHANGELOG__.replace(/^# Changelog\n/, "").replace(/^# /gm, "## "), { async: false })
</script>

<template>
	<h1>{{ $t("changelog") }}</h1>
	<p class="sb-changelog-rate">
		Liking streamBuddy?
		<a
			:href="reviewsUrl"
			target="_blank"
			rel="noopener"
			@click="saveRateAsk({ rateLinkOpened: true })"
		>
			Rate it on {{ storeName }}
		</a>
		to help other Letterboxd fans find it.
	</p>
	<!-- eslint-disable vue/no-v-html -->
	<div
		class="sb-changelog"
		v-html="changelog"
	/>
	<!--eslint-enable-->
</template>

<style scoped>
.sb-changelog-rate {
	max-width: 620px;
	color: var(--sb-text-muted);
}
.sb-changelog-rate a {
	color: var(--sb-accent);
	font-weight: 600;
}
.sb-changelog {
	max-width: 620px;
}
.sb-changelog :deep(h2) {
	margin: 28px 0 6px;
}
.sb-changelog :deep(ul) {
	display: grid;
	gap: 6px;
	padding-left: 20px;
	list-style: disc;
	color: var(--sb-text-muted);
}
</style>

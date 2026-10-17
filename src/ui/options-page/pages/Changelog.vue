<script setup lang="ts">
import { marked } from "marked"

// one page heading like the other pages; each release is a section under it
const changelog = marked.parse(__CHANGELOG__.replace(/^# (?!Changelog)/gm, "## "), { async: false })
</script>

<template>
	<!-- eslint-disable vue/no-v-html -->
	<div
		class="sb-changelog"
		v-html="changelog"
	/>
	<!--eslint-enable-->
</template>

<style scoped>
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

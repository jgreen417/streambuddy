<script setup lang="ts">
import PopupSettings from "@/components/popup/PopupSettings.vue"
</script>
<template>
	<h1>HBO Max</h1>
	<p class="description">Playback, ratings and discovery preferences.</p>
	<div class="sb sb-preferences-full">
		<PopupSettings
			service="HBO"
			expanded
			fixed-service
		/>
	</div>
</template>
<style>
@import "@/components/popup/popup.css";
</style>

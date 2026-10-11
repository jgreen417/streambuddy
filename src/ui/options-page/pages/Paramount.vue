<script setup lang="ts">
import PopupSettings from "@/components/popup/PopupSettings.vue"
</script>
<template>
	<h1>Paramount+</h1>
	<p class="description">
		Playback and card appearance preferences. Title-page, episode and search features currently support Netflix, HBO Max
		and Prime Video.
	</p>
	<div class="sb sb-preferences-full">
		<PopupSettings
			service="Paramount"
			expanded
			fixed-service
		/>
	</div>
</template>
<style>
@import "@/components/popup/popup.css";
</style>

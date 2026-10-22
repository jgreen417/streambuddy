<script setup lang="ts">
import PopupSettings from "@/components/popup/PopupSettings.vue"
import DiagnosticsPanel from "@/components/options/DiagnosticsPanel.vue"
</script>
<template>
	<h1>Viewing preferences</h1>
	<p class="description">
		Choose a service for playback and card ratings. Discovery and Letterboxd preferences apply across supported
		services.
	</p>
	<div class="sb sb-preferences-full">
		<PopupSettings
			:service="null"
			expanded
		/>
	</div>
	<DiagnosticsPanel />
</template>
<style>
@import "@/components/popup/popup.css";
</style>

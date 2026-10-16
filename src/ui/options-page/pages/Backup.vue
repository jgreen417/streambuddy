<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useOptionsStore } from "@/stores/options.store"

const { t } = useI18n()
const optionsStore = useOptionsStore()
const { settings } = storeToRefs(optionsStore)

async function resetAddon() {
	if (confirm(t("resetConfirm"))) {
		await browser.storage.local.clear()
		await browser.storage.sync.clear()
		location.reload()
	}
}
const file = new Blob([JSON.stringify(settings.value)], { type: "text/json" })
const href = URL.createObjectURL(file)

function replaceSettings(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	if (file === undefined || file.type !== "application/json") {
		alert(t("invalidJson"))
		return
	}
	const reader = new FileReader()
	reader.addEventListener("load", () => {
		try {
			settings.value = JSON.parse(reader.result as string)
		} catch {
			alert(t("invalidJson"))
		}
	})
	reader.readAsText(file)
}
</script>

<template>
	<div>
		<div class="flex flex-col flex-align">
			<h2>{{ $t("importSettings") }}</h2>
			<div>
				<a
					class="btn btn-secondary rounded-2xl my-2"
					:href="href"
					download="settings.json"
				>
					{{ $t("saveSettings") }}
				</a>
			</div>
			<div class="flex flex-row flex-align">
				<p>{{ $t("uploadSettings") }}</p>
				<input
					type="file"
					name="settings"
					accept="text/json"
					class="file-input w-full max-w-xs"
					@change="replaceSettings"
				/>
			</div>
			<!-- <div class="flex flex-row flex-align">
				<input
					type="file"
					name="settings"
					accept="text/json"
				/>
				<div class="btn btn-secondary rounded-2xl">{{ $t("uploadSettings") }}</div>
			</div> -->
		</div>
	</div>
	<div
		class="btn btn-secondary rounded-2xl reset my-2"
		@click="resetAddon"
	>
		{{ $t("resetAddon") }}
	</div>
</template>

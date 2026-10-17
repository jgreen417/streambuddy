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
	<h1>Backup</h1>
	<p class="description">Save your settings to a file to keep them or move them to another browser.</p>
	<ul class="sb-backup">
		<li>
			<span>{{ $t("saveSettings") }}</span>
			<a
				:href="href"
				download="settings.json"
			>
				Save
			</a>
		</li>
		<li>
			<span>{{ $t("uploadSettings") }}</span>
			<label>
				Choose file
				<input
					type="file"
					name="settings"
					accept="application/json,.json"
					class="sr-only"
					@change="replaceSettings"
				/>
			</label>
		</li>
		<li>
			<span>
				{{ $t("resetAddon") }}
				<small>Puts every setting back to how it was when installed.</small>
			</span>
			<button
				type="button"
				class="sb-danger"
				@click="resetAddon"
			>
				Reset
			</button>
		</li>
	</ul>
</template>

<style scoped>
.sb-backup {
	list-style: none;
	padding: 0;
	margin: 12px 0 0;
	max-width: 620px;
	display: grid;
	gap: 6px;
}
.sb-backup li {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--sb-surface-sunken);
	border: 1px solid var(--sb-line);
}
.sb-backup small {
	display: block;
	color: var(--sb-text-muted);
	font-size: 13px;
}
.sb-backup a,
.sb-backup label,
.sb-backup button {
	flex: none;
	padding: 5px 12px;
	border-radius: 999px;
	border: 1px solid var(--sb-line-raised);
	background: var(--sb-surface);
	color: var(--sb-text);
	font-size: 13px;
	text-decoration: none;
	cursor: pointer;
}
.sb-backup a:hover,
.sb-backup label:hover,
.sb-backup button:hover {
	background: var(--sb-surface-hover);
}
.sb-backup label {
	position: relative;
}
.sb-backup label:has(input:focus-visible) {
	outline: 2px solid var(--sb-focus);
	outline-offset: 2px;
}
.sb-backup .sb-danger {
	color: var(--sb-danger);
}
</style>

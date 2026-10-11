<script setup lang="ts">
import { useId } from "vue"
const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; description?: string; disabled?: boolean; mixed?: boolean }>()
const id = useId()
</script>

<template>
	<label
		class="sb-preference"
		:class="{ 'is-disabled': disabled }"
	>
		<span class="sb-preference-copy">
			<span class="sb-preference-label">{{ label }}</span>
			<small
				v-if="description || mixed"
				:id="id"
			>
				{{ description }}
				<template v-if="mixed">{{ description ? " · " : "" }}Mixed settings</template>
			</small>
		</span>
		<input
			class="sb-toggle-input"
			type="checkbox"
			:role="mixed ? 'checkbox' : 'switch'"
			:checked="model"
			:indeterminate="mixed"
			:disabled="disabled"
			:aria-label="label"
			:aria-checked="mixed ? 'mixed' : model"
			:aria-describedby="description || mixed ? id : undefined"
			@change="model = ($event.target as HTMLInputElement).checked"
		/>
		<span
			class="sb-toggle"
			aria-hidden="true"
		></span>
	</label>
</template>

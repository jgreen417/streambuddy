<template>
	<label class="switch">
		<input
			ref="input"
			:checked="props.modelValue"
			:aria-label="props.label"
			type="checkbox"
			role="switch"
			@input="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
		/>
		<span class="slider round"></span>
	</label>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
// components emits value
const props = defineProps<{ modelValue?: boolean; label?: string }>()
const emit = defineEmits(["update:modelValue"])

// Most switches sit in a settings table or next to their text without a label of their own, which screen readers
// announce as just "switch". Name them from that context: "Skip Intro – Netflix", or the text beside them.
const input = ref<HTMLInputElement>()
function describeFromContext(el: HTMLElement): string {
	const clean = (text?: string | null) => text?.replaceAll(/\s+/g, " ").replace(/:$/, "").trim() ?? ""
	// the visible label is the first <p> (tooltips with long descriptions sit beside it)
	const labelOf = (node?: Element | null) => clean((node?.querySelector("p") ?? node)?.textContent)
	const cell = el.closest("td")
	if (cell) {
		const rowName = labelOf(cell.closest("tr")?.querySelector("td"))
		const header = labelOf(cell.closest("table")?.querySelector("tr")?.children[cell.cellIndex])
		return [rowName, header].filter(Boolean).join(" – ")
	}
	let container = el.parentElement?.parentElement
	while (container && !labelOf(container)) container = container.parentElement
	return labelOf(container).slice(0, 80)
}
onMounted(() => {
	if (input.value && !props.label) input.value.setAttribute("aria-label", describeFromContext(input.value) || "Toggle")
})
</script>

<style scoped>
/* streamBuddy switch: small and monochrome, same as the popup's */
.switch {
	position: relative;
	display: inline-block;
	width: 32px;
	height: 18px;
	flex-shrink: 0;
}
.switch input {
	opacity: 0;
	width: 0;
	height: 0;
}
.slider {
	position: absolute;
	inset: 0;
	cursor: pointer;
	background-color: rgba(255, 255, 255, 0.13);
	transition: background-color 0.15s;
}
.slider:before {
	position: absolute;
	content: "";
	height: 14px;
	width: 14px;
	left: 2px;
	bottom: 2px;
	background-color: #9aa3ac;
	transition:
		transform 0.15s,
		background-color 0.15s;
}
input:checked + .slider {
	background-color: #e8eaed;
}
input:checked + .slider:before {
	transform: translateX(14px);
	background-color: #0b0d10;
}
input:focus-visible + .slider {
	outline: 2px solid rgba(255, 255, 255, 0.4);
	outline-offset: 2px;
}
.slider.round {
	border-radius: 999px;
}
.slider.round:before {
	border-radius: 50%;
}
</style>

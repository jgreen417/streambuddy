import { settings } from "@/stores/settings"

export const ratingSources = () => settings.value.General.ratingSources

export const locale = () => document.documentElement.lang || navigator?.language || "en-US"

import type { settingsType } from "@/stores/storeTypes"
import type { StreamingService } from "@/constants/streamingServices"
export type PreferenceState = boolean | "mixed"
export type RatingMode = "off" | "dim" | "hide"

export function getServiceState(
	settings: settingsType,
	targets: readonly StreamingService[],
	keys: string[],
): PreferenceState {
	const values = targets.flatMap((service) =>
		keys
			.map((key) => (settings[service] as unknown as Record<string, unknown>)[key])
			.filter((value) => typeof value === "boolean"),
	)
	if (!values.length) return false
	return values.every(Boolean) ? true : values.some(Boolean) ? "mixed" : false
}
export function setServiceState(
	settings: settingsType,
	targets: readonly StreamingService[],
	keys: string[],
	value: boolean,
) {
	for (const service of targets) {
		const entry = settings[service] as unknown as Record<string, unknown>
		for (const key of keys) {
			if (typeof entry[key] !== "boolean") continue
			entry[key] = value
		}
	}
}
export function getRatingMode(settings: settingsType, supportsHide: boolean): RatingMode {
	return supportsHide && settings.General.hideBelowRating ? "hide" : settings.Video.dimLowRatings ? "dim" : "off"
}
export function setRatingMode(settings: settingsType, mode: RatingMode, supportsHide: boolean) {
	if (mode === "hide" && !supportsHide) return
	settings.Video.dimLowRatings = mode === "dim"
	if (supportsHide) settings.General.hideBelowRating = mode === "hide"
}

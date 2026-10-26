// The hide/show ratings shortcut (Alt+Shift+B unless changed in the browser): flips card ratings for this tab's
// service, the same setting as the popup's "Ratings on title cards", and says so for a moment
import { onMessage } from "webext-bridge/content-script"
import type { StreamingService } from "@/constants/streamingServices"
import { settings } from "@/stores/settings"
import { installPageFeatureStyle } from "@/utils/page-feature-styles"

const NOTICE_MS = 2500

export function listenForRatingsShortcut(service: StreamingService) {
	let timer: ReturnType<typeof setTimeout> | undefined
	onMessage("toggleRatings", ({ data }) => {
		const prefs = settings.value[service]
		prefs.showRating = !prefs.showRating
		installPageFeatureStyle()
		document.querySelector(".sb-shortcut-notice")?.remove()
		const notice = document.createElement("div")
		notice.className = "sb-shortcut-notice"
		notice.setAttribute("role", "status")
		notice.textContent = prefs.showRating ? "Ratings shown" : "Ratings hidden"
		if (data.shortcut) notice.append(` · ${data.shortcut} to ${prefs.showRating ? "hide" : "show"} them`)
		document.body.append(notice)
		clearTimeout(timer)
		timer = setTimeout(() => notice.remove(), NOTICE_MS)
	})
}

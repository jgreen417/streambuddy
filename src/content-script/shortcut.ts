// The hide/show ratings shortcut: flips the popup's "Ratings on title cards" for this tab's service
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
		// a fullscreen player hides everything outside it
		const parent = document.fullscreenElement ?? document.body
		parent.append(notice)
		clearTimeout(timer)
		timer = setTimeout(() => notice.remove(), NOTICE_MS)
	})
}

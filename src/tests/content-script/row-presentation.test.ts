import { beforeEach, describe, expect, it } from "vitest"
import { RowPresentation } from "../../utils/row-presentation"

describe("row presentation", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
	})
	function card(parent: HTMLElement = document.body) {
		const element = document.createElement("article")
		parent.append(element)
		return element
	}
	const options = { fadeWatched: true }

	it("updates watched state after a sync and removes effects when switched off", () => {
		const presentation = new RowPresentation(),
			a = card()
		a.style.opacity = "0.8"
		presentation.track(a)
		presentation.refresh(options, () => false)
		expect(a.classList.contains("sb-watched")).toBe(false)
		presentation.refresh(options, () => true)
		expect(a.classList.contains("sb-watched")).toBe(true)
		presentation.refresh({ fadeWatched: false }, () => true)
		expect(a.classList.contains("sb-watched")).toBe(false)
		expect(a.style.opacity).toBe("0.8")
	})

	it("collapses a whole slot and restores it without overriding manual hiding", () => {
		const presentation = new RowPresentation(),
			slot = card(),
			a = card(slot)
		slot.style.display = "none"
		presentation.track(a, slot)
		presentation.refresh(
			{ ...options, hideBelow: true },
			() => false,
			() => true,
		)
		expect(slot.classList.contains("sb-below-cutoff")).toBe(true)
		presentation.refresh(
			{ ...options, hideBelow: false },
			() => false,
			() => true,
		)
		expect(slot.classList.contains("sb-below-cutoff")).toBe(false)
		expect(slot.style.display).toBe("none")
	})

	it("clears presentation when a streaming site recycles a card for a different title", () => {
		const presentation = new RowPresentation(),
			a = card()
		presentation.track(a)
		presentation.refresh(
			{ ...options, hideBelow: true },
			() => true,
			() => true,
		)
		expect(presentation.prune(() => false)).toEqual([a])
		expect(a.classList.contains("sb-watched")).toBe(false)
		expect(a.classList.contains("sb-below-cutoff")).toBe(false)
	})
})

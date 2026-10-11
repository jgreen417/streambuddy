import { beforeEach, describe, expect, it } from "vitest"
import { RowPresentation, normalizeRowScore } from "../../utils/row-presentation"

describe("row presentation", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
	})
	function row(selector: string) {
		const section = document.createElement("section")
		if (selector === "netflix") section.className = "carousel-row"
		else section.dataset.testid = selector === "prime" ? "standard-carousel" : "home_rail"
		document.body.append(section)
		return section
	}
	function card(parent: HTMLElement) {
		const element = document.createElement("article")
		parent.append(element)
		return element
	}
	const options = { highlightBest: true, fadeWatched: true }

	it("compares mixed sources on the same scale and keeps ties within each row", () => {
		const presentation = new RowPresentation()
		const netflix = row("netflix"),
			prime = row("prime"),
			max = row("max")
		const a = card(netflix),
			b = card(netflix),
			c = card(netflix),
			d = card(prime),
			e = card(max)
		presentation.track(a, a, normalizeRowScore("letterboxd", 4.2))
		presentation.track(b, b, normalizeRowScore("imdb", 8.4))
		presentation.track(c, c, 7)
		presentation.track(d, d, 6)
		presentation.track(e, e, NaN)
		presentation.refresh(options, () => false)
		expect([a, b, d].every((el) => el.classList.contains("sb-best-in-row"))).toBe(true)
		expect(c.classList.contains("sb-best-in-row")).toBe(false)
		expect(e.classList.contains("sb-best-in-row")).toBe(false)
	})

	it("moves the highlight as ratings arrive and when a winning card leaves", () => {
		const presentation = new RowPresentation(),
			parent = row("netflix")
		const a = card(parent),
			b = card(parent)
		presentation.track(a, a, 7)
		presentation.refresh(options, () => false)
		presentation.track(b, b, 9)
		presentation.refresh(options, () => false)
		expect(a.classList.contains("sb-best-in-row")).toBe(false)
		expect(b.classList.contains("sb-best-in-row")).toBe(true)
		b.remove()
		presentation.refresh(options, () => false)
		expect(a.classList.contains("sb-best-in-row")).toBe(true)
	})

	it("updates watched state after a sync and removes effects when switched off", () => {
		const presentation = new RowPresentation(),
			a = card(row("max"))
		a.style.opacity = "0.8"
		presentation.track(a, a, 8)
		presentation.refresh(options, () => false)
		expect(a.classList.contains("sb-watched")).toBe(false)
		presentation.refresh(options, () => true)
		expect(a.classList.contains("sb-watched")).toBe(true)
		presentation.refresh({ highlightBest: false, fadeWatched: false }, () => true)
		expect(a.classList.contains("sb-watched")).toBe(false)
		expect(a.classList.contains("sb-best-in-row")).toBe(false)
		expect(a.style.opacity).toBe("0.8")
	})

	it("does not highlight search cards outside a carousel", () => {
		const presentation = new RowPresentation(),
			a = card(document.body)
		presentation.track(a, a, 9)
		presentation.refresh(options, () => true)
		expect(a.classList.contains("sb-best-in-row")).toBe(false)
		expect(a.classList.contains("sb-watched")).toBe(true)
	})

	it("fades the focusable card even when the ring surrounds a nested poster", () => {
		const presentation = new RowPresentation(),
			a = card(row("max")),
			poster = card(a)
		presentation.track(a, poster, 8)
		presentation.refresh(options, () => true)
		expect(a.classList.contains("sb-watched")).toBe(true)
		expect(poster.classList.contains("sb-best-in-row")).toBe(true)
	})

	it("ignores titles hidden by a parent slot", () => {
		const presentation = new RowPresentation(),
			parent = row("netflix")
		const a = card(parent),
			slot = card(parent),
			b = card(slot)
		slot.style.display = "none"
		presentation.track(a, a, 7)
		presentation.track(b, slot, 9)
		presentation.refresh(options, () => false)
		expect(a.classList.contains("sb-best-in-row")).toBe(true)
		expect(slot.classList.contains("sb-best-in-row")).toBe(false)
	})

	it("collapses a whole slot and restores it without overriding manual hiding", () => {
		const presentation = new RowPresentation(),
			parent = row("prime"),
			slot = card(parent),
			a = card(slot)
		slot.style.display = "none"
		presentation.track(a, a, 6, slot)
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
			a = card(row("netflix"))
		presentation.track(a, a, 8)
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

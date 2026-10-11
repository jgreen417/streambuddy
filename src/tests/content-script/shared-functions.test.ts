import { describe, it, expect } from "vitest"
import { parseAdTime, createSlider, HBO_fixTitle } from "../../content-script/shared-functions"
import { pickBestMatch } from "../../utils/tmdb"

describe("parseAdTime", () => {
	it("should parse '1:30' as 90 seconds", () => {
		expect(parseAdTime("1:30")).toBe(90)
	})

	it("should parse '0:45' as 45 seconds", () => {
		expect(parseAdTime("0:45")).toBe(45)
	})

	it("should parse '10:00' as 600 seconds", () => {
		expect(parseAdTime("10:00")).toBe(600)
	})

	it("should return false for null input", () => {
		expect(parseAdTime(null)).toBe(false)
	})

	it("should return false for invalid input", () => {
		expect(parseAdTime("invalid")).toBe(false)
	})
})

// Mock Ref type for createSlider
class Ref {
	constructor(public value: number) {}
}

describe("createSlider", () => {
	it("should create slider and speed elements", () => {
		const video = document.createElement("video") as HTMLVideoElement
		video.playbackRate = 1.0
		const videoSpeed = new Ref(1.0)
		const position = document.createElement("div")
		const sliderStyle = "width: 100px;"
		const speedStyle = "font-size: 12px;"

		const { slider, speed } = createSlider(video, videoSpeed, position, sliderStyle, speedStyle)

		expect(slider).toBeInstanceOf(HTMLInputElement)
		expect(speed).toBeInstanceOf(HTMLParagraphElement)
		expect(position.children.length).toBeGreaterThan(0)
		// Check slider attributes
		expect(slider.type).toBe("range")
		// Check speed text
		expect(speed.textContent).toContain("x")
	})
})

describe("HBO_fixTitle", () => {
	it("strips bidi marks, the position and badges", () => {
		expect(HBO_fixTitle("\u2066\u2068\u2068Weapons\u2069\u2069. \u20681 of 20\u2069. \u2068\u2068Leaving Soon\u2069\u2069\u2069")).toBe(
			"Weapons",
		)
	})

	it("keeps full stops that are part of the title", () => {
		expect(HBO_fixTitle("\u2066\u2068\u2068Freddy vs. Jason\u2069\u2069. \u20686 of 20\u2069. \u2068\u2068Just Added\u2069\u2069\u2069")).toBe(
			"Freddy vs. Jason",
		)
	})

	it("handles the grid label on detail pages", () => {
		expect(HBO_fixTitle("\u2066\u2068\u2068American Sniper\u2069\u2069. \u2068Row 1 of 5, Column 1 of 6\u2069\u2069")).toBe(
			"American Sniper",
		)
	})

	it("uses the whole label when there are no isolation marks", () => {
		expect(HBO_fixTitle("Mulholland Drive")).toBe("Mulholland Drive")
	})

	it("returns undefined without a label", () => {
		expect(HBO_fixTitle(null)).toBeUndefined()
		expect(HBO_fixTitle("")).toBeUndefined()
	})
})

describe("pickBestMatch", () => {
	it("prefers an exact title match over TMDb's first result", () => {
		const results = [
			{ id: 1, title: "Dune: Part Two" },
			{ id: 2, title: "Dune" },
		]
		expect(pickBestMatch(results, "Dune").id).toBe(2)
	})

	it("ignores case, accents and punctuation", () => {
		const results = [{ id: 1, name: "Something Else" }, { id: 2, original_title: "Amélie" }]
		expect(pickBestMatch(results, "amelie").id).toBe(2)
		expect(pickBestMatch([{ id: 3, title: "Fast & Furious" }], "Fast and Furious").id).toBe(3)
	})

	it("keeps TMDb's top exact match unless another is far more watched", () => {
		const remakes = [
			{ id: 1, title: "Carrie", vote_count: 3000, popularity: 20 },
			{ id: 2, title: "Carrie", vote_count: 4000, popularity: 25 },
		]
		expect(pickBestMatch(remakes, "Carrie").id).toBe(1)
		const showFirst = [
			{ id: 3, name: "The Flash", vote_count: 300, popularity: 10 },
			{ id: 4, title: "The Flash", vote_count: 5000, popularity: 40 },
		]
		expect(pickBestMatch(showFirst, "The Flash").id).toBe(4)
	})

	it("treats superscripts like digits", () => {
		expect(pickBestMatch([{ id: 1, title: "Other" }, { id: 9, title: "The Accountant 2" }], "The Accountant²").id).toBe(9)
	})

	it("falls back to the first result", () => {
		expect(pickBestMatch([{ id: 7, title: "Close" }, { id: 8, title: "Other" }], "Clos").id).toBe(7)
		expect(pickBestMatch(undefined, "Anything")).toBeUndefined()
	})
})

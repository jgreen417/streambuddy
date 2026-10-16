import { describe, expect, it, vi } from "vitest"
import {
	CreditsRatingPrompt,
	creditsLength,
	reviewState,
	starText,
	type ReviewViewer,
} from "../../utils/credits-review"
import type { FeatureRating } from "../../utils/page-features"

function video(currentTime = 3550) {
	const element = document.createElement("video")
	Object.defineProperty(element, "duration", { value: 3600 })
	element.currentTime = currentTime
	return element
}
const film: FeatureRating = {
	id: 1,
	title: "Past Lives",
	media_type: "movie",
	source: "letterboxd",
	rating: 3.9,
	rating_url: "https://letterboxd.com/film/past-lives/",
	friends_rating: 4.2,
	friends_count: 7,
	friends: [
		{ name: "sam", rating: 4.5 },
		{ name: "alex", rating: 4 },
		{ name: "priya", rating: 3.5 },
		{ name: "jo", rating: 3 },
	],
}
const signedIn: ReviewViewer = { username: "buddy", friends: true }
const review = () => document.querySelector<HTMLElement>(".sb-review")
const card = () => document.querySelector<HTMLElement>(".sb-review-card")!

describe("credits review", () => {
	it("picks the state from your account, diary and friends", () => {
		expect(reviewState(film, signedIn)).toBe("friends")
		expect(reviewState({ ...film, friends: [], friends_count: 0 }, signedIn)).toBe("nobody")
		expect(reviewState(film, { ...signedIn, watched: 4.5 })).toBe("logged")
		expect(reviewState(film, { ...signedIn, watched: 0 })).toBe("logged")
		expect(reviewState(film, { username: "", friends: true })).toBe("unlinked")
		expect(reviewState(film, { ...signedIn, friends: false })).toBe("plain")
	})
	it("only says nobody rated it when Letterboxd said so", () => {
		const unknown = { ...film, friends: undefined, friends_rating: undefined, friends_count: undefined }
		// friends' ratings weren't fetched: an IMDb or TMDb result, or the friends lookup failed
		expect(reviewState({ ...unknown, source: "imdb" }, signedIn)).toBe("plain")
		expect(reviewState({ ...unknown, source: "tmdb" }, signedIn)).toBe("plain")
		expect(reviewState(unknown, signedIn)).toBe("plain")
		document.body.innerHTML = ""
		new CreditsRatingPrompt().tick(video(), { ...unknown, source: "imdb", rating: 7.8 }, true, signedIn)
		expect(document.querySelector(".sb-review")!.textContent).not.toContain("Be the first")
		expect(document.querySelector(".sb-review")!.textContent).not.toContain("None of your friends")
	})
	it("writes half stars and pads to five", () => {
		expect(starText(4.5)).toEqual({ filled: "★★★★½", empty: "" })
		expect(starText(3)).toEqual({ filled: "★★★", empty: "★★" })
	})
	it("starts as a collapsed pill and expands into the card", () => {
		document.body.innerHTML = ""
		new CreditsRatingPrompt().tick(video(), film, true, signedIn)
		expect(review()?.textContent).toContain("Review Past Lives")
		expect(review()?.textContent).toContain("7 friends rated it")
		expect(card().inert).toBe(true)
		const toggle = document.querySelector<HTMLButtonElement>(".sb-review-toggle")!
		expect(toggle.getAttribute("aria-expanded")).toBe("false")
		toggle.click()
		expect(card().inert).toBe(false)
		expect(toggle.getAttribute("aria-expanded")).toBe("true")
		expect(card().textContent).toContain("You just finished Past Lives")
		// three friends in the card, the rest behind "see all"
		expect(card().querySelectorAll(".sb-review-friend")).toHaveLength(3)
		expect(card().querySelector<HTMLAnchorElement>(".sb-review-more")!.href).toBe(
			"https://letterboxd.com/buddy/friends/film/past-lives/",
		)
		expect(card().querySelector<HTMLAnchorElement>("a.sb-review-primary")!.href).toBe(film.rating_url)
	})
	it("offers to log a film that's already in your diary again", () => {
		document.body.innerHTML = ""
		new CreditsRatingPrompt().tick(video(), film, true, { ...signedIn, watched: 4.5 })
		const again = document.querySelector<HTMLAnchorElement>(".sb-review-action")!
		expect(again.textContent).toBe("Log again?")
		expect(again.href).toBe(film.rating_url)
		expect(review()?.textContent).toContain("You rated it")
	})
	it("asks to connect Letterboxd when none is linked", () => {
		document.body.innerHTML = ""
		const openSetup = vi.fn()
		new CreditsRatingPrompt(openSetup).tick(video(), { ...film, friends: undefined, friends_count: undefined }, true, {
			username: "",
			friends: true,
		})
		expect(review()?.textContent).toContain("No Letterboxd linked")
		document.querySelector<HTMLButtonElement>("button.sb-review-action")!.click()
		expect(openSetup).toHaveBeenCalledOnce()
		expect(review()).toBeNull()
	})
	it("Escape closes the card first, then the pill", () => {
		document.body.innerHTML = ""
		new CreditsRatingPrompt().tick(video(), film, true, signedIn)
		document.querySelector<HTMLButtonElement>(".sb-review-chevron")!.click()
		const escape = () => review()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
		escape()
		expect(card().inert).toBe(true)
		escape()
		expect(review()).toBeNull()
	})
	it("guesses the credits from the runtime, between 3 and 10 minutes", () => {
		expect(creditsLength(22 * 60)).toBe(180)
		expect(creditsLength(120 * 60)).toBeCloseTo(504)
		expect(creditsLength(200 * 60)).toBe(600)
	})
	it("only shows for films once their credits start, once per film", () => {
		document.body.innerHTML = ""
		const prompt = new CreditsRatingPrompt()
		// an hour-long film's credits are taken to start 4.2 minutes from the end
		prompt.tick(video(3300), film, true, signedIn)
		expect(review()).toBeNull()
		// a show with no Letterboxd page is ongoing TV
		prompt.tick(video(3400), { ...film, media_type: "tv", source: "imdb" }, true, signedIn)
		expect(review()).toBeNull()
		prompt.tick(video(3400), film, true, signedIn)
		expect(review()).not.toBeNull()
		document.querySelector<HTMLButtonElement>(".sb-review-close")!.click()
		prompt.tick(video(3400), film, true, signedIn)
		expect(review()).toBeNull()
	})
	it("shows for a limited series Letterboxd lists, apart from a film with the same id", () => {
		document.body.innerHTML = ""
		const prompt = new CreditsRatingPrompt()
		const series: FeatureRating = {
			...film,
			title: "Chernobyl",
			media_type: "tv",
			rating_url: "https://letterboxd.com/film/chernobyl/",
		}
		prompt.tick(video(3400), series, true, signedIn)
		expect(review()?.textContent).toContain("You just finished Chernobyl")
		document.querySelector<HTMLButtonElement>(".sb-review-close")!.click()
		prompt.tick(video(3400), film, true, signedIn)
		expect(review()?.textContent).toContain("Past Lives")
	})
	it("uses the service's own credits start when it has one", () => {
		document.body.innerHTML = ""
		const prompt = new CreditsRatingPrompt()
		// the service says the credits run 8 minutes, so 6 minutes from the end is already in them
		prompt.tick(video(3240), film, true, signedIn, 480)
		expect(review()).not.toBeNull()
		document.body.innerHTML = ""
		new CreditsRatingPrompt().tick(video(3500), film, true, signedIn, 60)
		expect(review()).toBeNull()
	})
	it("clears an old film's review when playback ends or switches", () => {
		document.body.innerHTML = ""
		const prompt = new CreditsRatingPrompt()
		prompt.tick(video(), film, true, signedIn)
		expect(review()).not.toBeNull()
		prompt.tick(null, null, true)
		expect(review()).toBeNull()
	})
})

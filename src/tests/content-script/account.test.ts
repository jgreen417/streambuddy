import { describe, expect, it } from "vitest"
import { cleanUsername, tmdbRequest } from "@/utils/account"

describe("tmdbRequest", () => {
	it("sends a read access token as a bearer header", () => {
		const request = tmdbRequest("https://api.themoviedb.org/3/search/multi?query=dune", "eyJhbGciOiJIUzI1NiJ9.abc.def")
		expect(request.headers.Authorization).toBe("Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")
		expect(request.url).toBe("https://api.themoviedb.org/3/search/multi?query=dune")
	})
	it("sends a 32-character v3 key as a query parameter", () => {
		const key = "0123456789abcdef0123456789abcdef"
		const request = tmdbRequest("https://api.themoviedb.org/3/search/multi?query=dune", key)
		expect(request.headers.Authorization).toBeUndefined()
		expect(new URL(request.url).searchParams.get("api_key")).toBe(key)
		expect(new URL(request.url).searchParams.get("query")).toBe("dune")
	})
})

describe("cleanUsername", () => {
	it.each([
		["exampleuser", "exampleuser"],
		["  @ExampleUser ", "exampleuser"],
		["https://letterboxd.com/exampleuser/", "exampleuser"],
		["letterboxd.com/exampleuser/films/", "exampleuser"],
		["https://www.letterboxd.com/exampleuser/films/", "exampleuser"],
	])("%s -> %s", (input, expected) => {
		expect(cleanUsername(input)).toBe(expected)
	})
})

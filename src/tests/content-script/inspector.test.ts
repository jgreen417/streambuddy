import { describe, expect, it } from "vitest"
import { parseProviders, providerService } from "../../content-script/inspector"

describe("watch providers", () => {
	it("dedupes a provider to its best offer and keeps TMDb's link", () => {
		expect(
			parseProviders(
				{
					results: {
						GB: {
							link: "https://www.themoviedb.org/movie/1/watch",
							flatrate: [{ provider_name: "Netflix" }, { provider_name: "Amazon Prime Video" }],
							rent: [{ provider_name: "Apple TV" }, { provider_name: "Amazon Prime Video" }],
							buy: [{ provider_name: "Apple TV" }],
						},
					},
				},
				"GB",
			),
		).toEqual({
			rows: [
				{ name: "Amazon Prime Video", kind: "flatrate" },
				{ name: "Netflix", kind: "flatrate" },
				{ name: "Apple TV", kind: "rent" },
			],
			link: "https://www.themoviedb.org/movie/1/watch",
		})
	})
	it("separates a missing region from an unreachable request", () => {
		expect(parseProviders({ results: {} }, "GB")).toEqual({ rows: [] })
		expect(parseProviders({ error: "HTTP 429" }, "GB")).toBeNull()
	})

	it("sends plan, store and channel variants to the service they're watched on", () => {
		expect(providerService("Netflix Standard with Ads")).toBe("Netflix")
		expect(providerService("Amazon Prime Video with Ads")).toBe("Amazon")
		expect(providerService("Amazon Video")).toBe("Amazon")
		expect(providerService("HBO Max Amazon Channel")).toBe("Amazon")
		expect(providerService("HBO Max")).toBe("HBO")
		expect(providerService("Disney Plus")).toBe("Disney")
		expect(providerService("Apple TV")).toBeUndefined()
	})
})

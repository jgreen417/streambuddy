import { describe, expect, it } from "vitest"
import { serviceForHost } from "@/constants/streamingServices"

describe("serviceForHost", () => {
	it("names the service only on hosts its content script runs on", () => {
		expect(serviceForHost("www.netflix.com")).toBe("Netflix")
		expect(serviceForHost("www.amazon.fr")).toBe("Amazon")
		expect(serviceForHost("play.hbomax.com")).toBe("HBO")
		expect(serviceForHost("www.disneyplus.com")).toBe("Disney")
		expect(serviceForHost("www.crunchyroll.com")).toBe("Crunchyroll")
		expect(serviceForHost("www.amazon.com.au")).toBeUndefined()
		expect(serviceForHost("notnetflix.com")).toBeUndefined()
	})
})

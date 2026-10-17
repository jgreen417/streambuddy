import { describe, expect, it } from "vitest"
import { maxCreditsMarker, primeCreditsMarker } from "../../utils/credits-markers"

// shapes and numbers from real playback responses, trimmed to the fields read
describe("Max credits marker", () => {
	it("measures a film's credits back from the end of the title", () => {
		// The Batman: credits at 10019.426 of 10570.935; the <video> ran 11134.53 with 563.6s of ads before the credits
		const marker = maxCreditsMarker({
			videos: [{ type: "main", duration: 10570.935, annotations: [{ type: "end-credits", start: 10019.426 }] }],
		})
		expect(marker?.creditsFromEnd).toBeCloseTo(551.509)
		expect(marker?.duration).toBeCloseTo(10570.935)
	})
	it("counts the promos played before the title", () => {
		// an episode: two promos, then the main video; its credits are on the playlist's timeline
		const marker = maxCreditsMarker({
			videos: [
				{ type: "promo", duration: 6.006 },
				{ type: "promo", duration: 159.993 },
				{ type: "main", duration: 4079.033, annotations: [{ type: "end-credits", start: 4102.891 }] },
				{ type: "promo", duration: 7.007 },
			],
		})
		expect(marker?.creditsFromEnd).toBeCloseTo(142.141)
		expect(marker?.duration).toBeCloseTo(4245.032)
	})
	it("has no marker when Max doesn't mark the credits", () => {
		// The Dark Knight Rises came with no annotations
		expect(
			maxCreditsMarker({
				videos: [
					{ type: "promo", duration: 4.004 },
					{ type: "main", duration: 9868.275 },
				],
			}),
		).toBeUndefined()
		expect(maxCreditsMarker({})).toBeUndefined()
	})
})

describe("Prime Video credits marker", () => {
	it("reads END_CREDITS against the title's length, in seconds", () => {
		const marker = primeCreditsMarker({
			transitionTimecodes: {
				result: {
					events: [
						{ eventType: "END_CREDITS", startTimeMs: 7752000 },
						{ eventType: "NEXT_UP", startTimeMs: 7759000 },
					],
				},
			},
			vodPlaylistedPlaybackUrls: { result: { playbackUrls: { fullTitleDurationMs: 8372000 } } },
		})
		expect(marker).toEqual({ creditsFromEnd: 620, duration: 8372 })
	})
	it("has no marker without END_CREDITS or a length", () => {
		expect(primeCreditsMarker({ transitionTimecodes: { result: { events: [] } } })).toBeUndefined()
		expect(
			primeCreditsMarker({
				transitionTimecodes: { result: { events: [{ eventType: "END_CREDITS", startTimeMs: 1 }] } },
			}),
		).toBeUndefined()
	})
})

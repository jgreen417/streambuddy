import { describe, expect, it } from "vitest"
import { listenForCreditsMarkers, markedCreditsFromEnd } from "../../content-script/credits-marker"
import {
	CREDITS_MESSAGE,
	disneyCreditsMarkers,
	maxCreditsMarker,
	primeCreditsMarker,
} from "../../utils/credits-markers"

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
	it("has only the title's length when Max doesn't mark the credits", () => {
		// The Dark Knight Rises came with no annotations
		const marker = maxCreditsMarker({
			videos: [
				{ type: "promo", duration: 4.004 },
				{ type: "main", duration: 9868.275 },
			],
		})
		expect(marker?.creditsFromEnd).toBeUndefined()
		expect(marker?.duration).toBeCloseTo(9872.279)
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
	it("has only the length without END_CREDITS, and nothing without a length", () => {
		expect(
			primeCreditsMarker({
				transitionTimecodes: { result: { events: [] } },
				vodPlaylistedPlaybackUrls: { result: { playbackUrls: { fullTitleDurationMs: 6462000 } } },
			}),
		).toEqual({ duration: 6462 })
		expect(
			primeCreditsMarker({
				transitionTimecodes: { result: { events: [{ eventType: "END_CREDITS", startTimeMs: 1 }] } },
			}),
		).toBeUndefined()
	})
})

describe("Disney+ credits marker", () => {
	// Star Wars: A New Hope: the player experience for its availId, and the playback response for the same availId
	const experience = {
		data: {
			playerExperience: {
				timeline: { runtimeMs: 7536000 },
				title: "Star Wars: A New Hope (Episode IV)",
				analytics: { programType: "movie" },
			},
		},
	}
	const playback = {
		stream: {
			editorial: [
				{ label: "FFEC", offsetMillis: 7221221 },
				{ label: "up_next", offsetMillis: 7253000 },
			],
			playbackRights: { externalIds: { availId: "e9fa3181" } },
		},
	}
	const url = "https://disney.api.edge.bamgrid.com/explore/v1.21/playerExperience/e9fa3181"

	it("joins the runtime and the end credits' first frame, whichever response comes first", () => {
		const film = { creditsFromEnd: 314.779, duration: 7536, title: "Star Wars: A New Hope (Episode IV)" }
		const first = disneyCreditsMarkers()
		expect(first.experience(experience, url)).toEqual({ duration: 7536, title: film.title })
		expect(first.playback(playback)).toMatchObject({ ...film, creditsFromEnd: expect.closeTo(314.779) })
		const second = disneyCreditsMarkers()
		expect(second.playback(playback)).toBeUndefined()
		expect(second.experience(experience, url)).toMatchObject({ ...film, creditsFromEnd: expect.closeTo(314.779) })
	})
	it("names an episode by its subtitle, and keeps titles apart by availId", () => {
		const markers = disneyCreditsMarkers()
		markers.playback(playback)
		const episode = markers.experience(
			{
				data: {
					playerExperience: {
						timeline: { runtimeMs: 1441000 },
						title: "The Simpsons",
						subtitle: "S1:E1 Simpsons Roasting on an Open Fire",
						analytics: { programType: "episode" },
					},
				},
			},
			url.replace("e9fa3181", "80c01b9e"),
		)
		expect(episode).toEqual({
			duration: 1441,
			title: "The Simpsons",
			episode: "S1:E1 Simpsons Roasting on an Open Fire",
		})
	})
})

describe("picking the marker for the video playing", () => {
	listenForCreditsMarkers()
	const send = (data: object) =>
		window.dispatchEvent(new MessageEvent("message", { source: window, data: { type: CREDITS_MESSAGE, ...data } }))
	const video = (duration: number) => ({ duration }) as HTMLVideoElement

	it("uses the marker whose title fits the video, ads included, not a trailer's or the next title's", () => {
		send({ creditsFromEnd: 551.5, duration: 10570.9 })
		send({ creditsFromEnd: 20, duration: 150 })
		send({ creditsFromEnd: 400, duration: 10000 })
		// The Batman with 563.6s of ads stitched in
		expect(markedCreditsFromEnd(video(11134.5))).toBe(551.5)
		expect(markedCreditsFromEnd(video(10010))).toBe(400)
		expect(markedCreditsFromEnd(video(5000))).toBeUndefined()
	})
	it("gives a title the service didn't mark no marker, not a similar title's", () => {
		send({ creditsFromEnd: 300, duration: 6000 })
		send({ duration: 6010 })
		expect(markedCreditsFromEnd(video(6200))).toBeUndefined()
	})
	it("ignores markers that make no sense", () => {
		send({ creditsFromEnd: 3000, duration: 3000 })
		send({ creditsFromEnd: Number.NaN, duration: 3000 })
		expect(markedCreditsFromEnd(video(3000))).toBeUndefined()
	})
})

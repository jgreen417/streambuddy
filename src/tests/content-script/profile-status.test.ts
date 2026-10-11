import { describe, it, expect, vi, beforeEach } from "vitest"
const transport = vi.hoisted(() => ({ read: vi.fn(), sync: vi.fn() }))
vi.mock("webextension-polyfill", () => ({
	default: { storage: { local: { get: transport.read } } },
	storage: { local: { get: transport.read } },
}))
vi.mock("webext-bridge/popup", () => ({ sendMessage: transport.sync }))
beforeEach(() => {
	vi.resetModules()
	transport.read.mockReset()
	transport.sync.mockReset()
})
describe("profile feedback", () => {
	it("reports sync failure while retaining the previous successful profile", async () => {
		transport.read.mockResolvedValue({
			letterboxdProfile: { username: "person", fetchedAt: Date.now(), watched: { film: 4 }, watchlist: ["next"] },
		})
		const { useLetterboxdProfile } = await import("../../components/popup/useLetterboxdProfile")
		const state = useLetterboxdProfile()
		await Promise.resolve()
		transport.sync.mockRejectedValue(new Error("Offline"))
		await state.sync().catch(() => {})
		expect(state.error?.value).toBeTruthy()
		expect(state.summary.value?.logged).toBe(1)
		expect(state.syncing.value).toBe(false)
	})
	it("reports empty sync results as a recoverable failure", async () => {
		transport.read.mockResolvedValue({})
		transport.sync.mockResolvedValue(null)
		const { useLetterboxdProfile } = await import("../../components/popup/useLetterboxdProfile")
		const state = useLetterboxdProfile()
		await state.sync()
		expect(state.error?.value).toBeTruthy()
	})
	it("ends profile loading after storage failure", async () => {
		transport.read.mockRejectedValue(new Error("Storage unavailable"))
		const { useLetterboxdProfile } = await import("../../components/popup/useLetterboxdProfile")
		const state = useLetterboxdProfile()
		await Promise.resolve()
		await Promise.resolve()
		expect(state.loading?.value).toBe(false)
		expect(state.error?.value).toBeTruthy()
	})
})

import type { LetterboxdProfile } from "./ratings"
type IO = {
	read: () => Promise<LetterboxdProfile | undefined>
	fetch: () => Promise<LetterboxdProfile | null>
	write: (profile: LetterboxdProfile) => Promise<void>
}
// username can be a getter: it's entered during onboarding and may change while the worker runs
export function createProfileSync(getUsername: string | (() => Promise<string>), io: IO) {
	let inFlight: Promise<LetterboxdProfile> | null = null
	return async (force = false): Promise<LetterboxdProfile | null | { error: string }> => {
		const username = typeof getUsername === "string" ? getUsername : await getUsername()
		if (!username) return null
		let cached: LetterboxdProfile | undefined
		try {
			const stored = await io.read()
			cached = stored?.username === username ? stored : undefined
			if (!force && cached && cached.fetchedAt > 0 && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached
			inFlight ??= io
				.fetch()
				.then(async (profile) => {
					if (!profile) throw new Error("Profile unavailable")
					await io.write(profile)
					return profile
				})
				.finally(() => {
					inFlight = null
				})
			return await inFlight
		} catch {
			return force ? { error: "Letterboxd could not refresh the profile." } : (cached ?? null)
		}
	}
}

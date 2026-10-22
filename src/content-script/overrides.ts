// A user's correction for a card title that resolved to the wrong film or show. The mapping is per card title, so it
// applies wherever that title appears, and it is local: the wrong match is a device's problem, not an account setting.
export type TitleOverride = {
	id: number
	media_type: "movie" | "tv"
	title: string
	year?: string
}

const STORAGE_KEY = "titleOverrides"

// "Dune: Part Two" and "dune part two" are the same card title to a person, so they share an override. Letters
// and their marks in any script count (only Latin accents are dropped), so other scripts keep keys of their own.
export const overrideKey = (title: string) =>
	title
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{M}\p{N}]+/gu, " ")
		.trim()

let overrides: Record<string, TitleOverride> = {}

export async function loadOverrides() {
	const stored = await browser.storage.local.get(STORAGE_KEY)
	overrides = (stored[STORAGE_KEY] as Record<string, TitleOverride> | undefined) ?? {}
	browser.storage.onChanged.addListener((changes, area) => {
		if (area === "local" && changes[STORAGE_KEY])
			overrides = (changes[STORAGE_KEY].newValue as Record<string, TitleOverride> | undefined) ?? {}
	})
}

export const overrideFor = (title: string) => overrides[overrideKey(title)]

// built on what's stored now rather than this tab's copy, so a fix saved in another tab isn't overwritten
async function update(change: (all: Record<string, TitleOverride>) => void) {
	const stored = await browser.storage.local.get(STORAGE_KEY)
	const next = { ...(stored[STORAGE_KEY] as Record<string, TitleOverride> | undefined) }
	change(next)
	await browser.storage.local.set({ [STORAGE_KEY]: next })
	overrides = next
}

export async function saveOverride(title: string, value: TitleOverride) {
	const key = overrideKey(title)
	if (key) await update((all) => (all[key] = value))
}

export async function clearOverride(title: string) {
	await update((all) => delete all[overrideKey(title)])
}

export const overrideCount = () => Object.keys(overrides).length

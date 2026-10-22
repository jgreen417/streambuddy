// A user's correction for a card title that resolved to the wrong film or show. The mapping is per card title, so it
// applies wherever that title appears, and it is local: the wrong match is a device's problem, not an account setting.
export type TitleOverride = {
	id: number
	media_type: "movie" | "tv"
	title: string
	year?: string
}

const STORAGE_KEY = "titleOverrides"

// "Dune: Part Two" and "dune part two" are the same card title to a person, so they share an override
export const overrideKey = (title: string) =>
	title
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim()

let overrides: Record<string, TitleOverride> = {}

export async function loadOverrides() {
	try {
		const stored = await browser.storage.local.get(STORAGE_KEY)
		const value = stored?.[STORAGE_KEY]
		overrides = value && typeof value === "object" ? (value as Record<string, TitleOverride>) : {}
	} catch {
		overrides = {}
	}
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !changes[STORAGE_KEY]) return
		const value = changes[STORAGE_KEY].newValue
		overrides = value && typeof value === "object" ? (value as Record<string, TitleOverride>) : {}
	})
}

export const overrideFor = (title: string) => overrides[overrideKey(title)]

export async function saveOverride(title: string, value: TitleOverride) {
	overrides = { ...overrides, [overrideKey(title)]: value }
	await browser.storage.local.set({ [STORAGE_KEY]: overrides })
}

export async function clearOverride(title: string) {
	const next = { ...overrides }
	delete next[overrideKey(title)]
	overrides = next
	await browser.storage.local.set({ [STORAGE_KEY]: overrides })
}

export const overrideCount = () => Object.keys(overrides).length

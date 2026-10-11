import type { SkipKind, SkipRules } from "./types"

const STORAGE_KEY = "skipRules"

export const showKey = (title: string) =>
	title
		.normalize("NFKD")
		.replaceAll(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim()

export function isExcepted(rules: SkipRules, title: string | null, kind: SkipKind): boolean {
	return !!title && !!rules[showKey(title)]?.includes(kind)
}

export function withException(rules: SkipRules, title: string, kind: SkipKind): SkipRules {
	const key = showKey(title)
	const kinds = new Set(rules[key] ?? [])
	kinds.add(kind)
	return { ...rules, [key]: [...kinds] }
}

export function withoutException(rules: SkipRules, key: string, kind: SkipKind): SkipRules {
	const kinds = (rules[key] ?? []).filter((k) => k !== kind)
	const next = { ...rules }
	if (kinds.length) next[key] = kinds
	else delete next[key]
	return next
}

// rules follow the user between browsers, like their settings
export async function loadRules(): Promise<SkipRules> {
	try {
		const result = await browser.storage.sync.get(STORAGE_KEY)
		return (result?.[STORAGE_KEY] as SkipRules | undefined) ?? {}
	} catch {
		return {}
	}
}
export async function saveRules(rules: SkipRules) {
	await browser.storage.sync.set({ [STORAGE_KEY]: rules })
}
export function onRulesChanged(callback: (rules: SkipRules) => void) {
	browser.storage?.onChanged?.addListener((changes, area) => {
		if (area === "sync" && changes[STORAGE_KEY]) callback((changes[STORAGE_KEY].newValue as SkipRules) ?? {})
	})
}

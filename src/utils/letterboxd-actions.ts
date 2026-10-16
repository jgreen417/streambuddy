export function extractLetterboxdCsrf(html: string): string | null {
	const scriptToken = html.match(/\bsupermodelCSRF\s*=\s*(["'])([a-zA-Z0-9._~-]+)\1/)?.[2]
	if (scriptToken && scriptToken !== "placeholder") return scriptToken
	for (const input of html.match(/<input\b[^>]*>/gi) ?? []) {
		if (/\bname\s*=\s*["']__csrf["']/i.test(input)) {
			const value = input.match(/\bvalue\s*=\s*["']([^"']+)["']/i)?.[1]
			if (value && value !== "placeholder") return value.replaceAll("&amp;", "&")
		}
	}
	return null
}

// Called only after the user confirms this specific film. Never log the session token.
export async function addLetterboxdWatchlist(slug: string, confirmed: boolean) {
	if (!confirmed) throw new Error("Confirmation required")
	if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Invalid film")
	const page = await fetch(`https://letterboxd.com/film/${slug}/`, { credentials: "include" })
	if (!page.ok) throw new Error("Open Letterboxd and sign in, then try again")
	const csrf = extractLetterboxdCsrf(await page.text())
	if (!csrf) throw new Error("Open Letterboxd and sign in, then try again")
	const response = await fetch(`https://letterboxd.com/film/${slug}/add-to-watchlist/`, {
		method: "POST",
		credentials: "include",
		headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest" },
		body: new URLSearchParams({ __csrf: csrf }),
	})
	const result = await response.json().catch(() => null)
	if (!response.ok || (result?.result !== true && result?.success !== true))
		throw new Error("Letterboxd did not confirm the change. Check your watchlist on Letterboxd.")
}

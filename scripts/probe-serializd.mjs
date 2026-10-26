// Unauthenticated, read-only probe. No credentials, cookies or user data are read or written.
const endpoints = [
	"https://www.serializd.com/show/The-Office-2316",
	"https://serializd.onrender.com/api/show/2316",
	"https://serializd.onrender.com/mobile/page/show_v2_part_1/2316",
	"https://serializd.onrender.com/mobile/page/show/2316/season/1/episode_part_1/5",
]

for (const url of endpoints) {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(12_000), redirect: "error" })
		const body = await response.text()
		const classification =
			response.status === 401
				? "authentication-required"
				: response.status === 403 && body.includes("Just a moment")
					? "cloudflare-challenge"
					: response.ok
						? "reachable-contract-unverified"
						: "http-error"
		console.log(JSON.stringify({ url, status: response.status, classification }))
	} catch (error) {
		console.log(JSON.stringify({ url, classification: "request-failed", message: error.message }))
	}
}

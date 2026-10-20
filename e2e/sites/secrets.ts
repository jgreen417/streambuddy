import type { Capture } from "./replay"

// A feed's answer carries the account's session beside the data streamBuddy reads: tokens, signed links and the ids
// that follow a device or a user around. They're taken out before a capture is written, so a saved page holds none.
// None of streamBuddy's readers use a key like these.
const SECRET_KEY =
	/token|authori[sz]|authurl|session|cookie|secret|password|credential|signature|email|guid|device_?id|user_?id|account_?id|customer_?id|profile_?id/i
// a signed link's other parts (CloudFront, Akamai)
const SIGNED = /^(sig|policy|key-pair-id|hdnt[sl])$/i
// a JSON web token, on its own or inside a longer string
export const JWT = /eyJ[\w-]{20,}\.[\w-]+(\.[\w-]*)*/g

function withoutSignature(text: string) {
	if (!/^https?:\/\/[^?]+\?/.test(text) || !URL.canParse(text)) return text
	const url = new URL(text)
	const keys = [...url.searchParams.keys()].filter((key) => SECRET_KEY.test(key) || SIGNED.test(key))
	for (const key of keys) url.searchParams.delete(key)
	return keys.length ? url.href : text
}

function withoutSecrets(value: unknown): unknown {
	if (typeof value === "string") return withoutSignature(value.replace(JWT, ""))
	if (Array.isArray(value)) return value.map(withoutSecrets)
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !SECRET_KEY.test(key))
				.map(([key, inner]) => [key, withoutSecrets(inner)]),
		)
	return value
}

// A request's body, a form or JSON, the same way. One with nothing to take out is kept exactly as sent, since the
// replay matches streamBuddy's own requests to the recorded ones by their body.
function requestWithoutSecrets(body: string | null) {
	if (body === null) return null
	if (/^\s*[[{]/.test(body)) {
		const json: unknown = JSON.parse(body)
		const cleaned = JSON.stringify(withoutSecrets(json))
		return cleaned === JSON.stringify(json) ? body : cleaned
	}
	const form = new URLSearchParams(body)
	const keys = [...form.keys()].filter((key) => SECRET_KEY.test(key))
	for (const key of keys) form.delete(key)
	return keys.length ? form.toString() : body.replace(JWT, "")
}

export function feedsWithoutSecrets(feeds: Capture["feeds"]) {
	return Object.fromEntries(
		Object.entries(feeds).map(([name, entries]) => [
			name,
			entries.map(({ url, request, body }) => ({
				url: withoutSecrets(url),
				request: requestWithoutSecrets(request ?? null),
				body: withoutSecrets(body),
			})),
		]),
	)
}

// upload a release zip to the Chrome Web Store and submit it for review, through the Chrome Web Store API v2
// usage: tsx scripts/publish-chrome.ts release/chrome-1.0.3.zip
// env: CWS_SERVICE_ACCOUNT_JSON (the service account's JSON key), CWS_PUBLISHER_ID, CWS_EXTENSION_ID
import { createSign } from "node:crypto"
import { readFileSync } from "node:fs"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const API = "https://chromewebstore.googleapis.com"
const SCOPE = "https://www.googleapis.com/auth/chromewebstore"

function env(name: string): string {
	const value = process.env[name]
	if (!value) throw new Error(`${name} is not set`)
	return value
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url")

// service account key -> signed JWT -> short-lived access token
async function accessToken(keyJson: string): Promise<string> {
	const key = JSON.parse(keyJson) as { client_email: string; private_key: string; token_uri?: string }
	const tokenUri = key.token_uri || "https://oauth2.googleapis.com/token"
	const now = Math.floor(Date.now() / 1000)
	const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
		JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
	)}`
	const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key)
	const response = await fetch(tokenUri, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: `${unsigned}.${base64url(signature)}`,
		}),
	})
	const body = (await response.json()) as { access_token?: string }
	if (!response.ok || !body.access_token)
		throw new Error(`token exchange failed: ${response.status} ${JSON.stringify(body)}`)
	return body.access_token
}

async function call(token: string, method: string, url: string, body?: Buffer) {
	const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body })
	const text = await response.text()
	if (!response.ok) throw new Error(`${method} ${url} failed: ${response.status} ${text}`)
	return (text ? JSON.parse(text) : {}) as Record<string, unknown>
}

async function main() {
	const zipPath = process.argv[2]
	if (!zipPath) throw new Error("usage: tsx scripts/publish-chrome.ts <zip>")
	const item = `publishers/${env("CWS_PUBLISHER_ID")}/items/${env("CWS_EXTENSION_ID")}`
	const token = await accessToken(env("CWS_SERVICE_ACCOUNT_JSON"))

	const upload = await call(token, "POST", `${API}/upload/v2/${item}:upload`, readFileSync(zipPath))
	let state = upload.uploadState
	console.log(`Upload: ${state}${upload.crxVersion ? ` (version ${upload.crxVersion})` : ""}`)
	// big packages are processed asynchronously
	for (let tries = 0; state === "IN_PROGRESS" || state === "UPLOAD_IN_PROGRESS"; tries++) {
		if (tries === 30) throw new Error("upload still processing after 5 minutes")
		await sleep(10_000)
		state = (await call(token, "GET", `${API}/v2/${item}:fetchStatus`)).lastAsyncUploadState
		console.log(`Upload: ${state}`)
	}
	if (state !== "SUCCEEDED") throw new Error(`upload ended in state ${state}`)

	// submits for review; Chrome publishes it to everyone once the review passes
	const publish = await call(token, "POST", `${API}/v2/${item}:publish`)
	console.log(`Submitted for review: ${JSON.stringify(publish)}`)
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
})

// upload a release zip to the Chrome Web Store and submit it for review, through the Chrome Web Store API v2
// usage: tsx scripts/publish-chrome.ts release/chrome-1.0.3.zip
// env: CWS_ACCESS_TOKEN (an OAuth access token with the chromewebstore scope, minted in the workflow through
// Workload Identity Federation, so no key file exists), CWS_PUBLISHER_ID, CWS_EXTENSION_ID
import { readFileSync } from "node:fs"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const API = "https://chromewebstore.googleapis.com"

function env(name: string): string {
	const value = process.env[name]
	if (!value) throw new Error(`${name} is not set`)
	return value
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
	const token = env("CWS_ACCESS_TOKEN")

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

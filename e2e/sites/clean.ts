// Takes the account's tokens and ids out of every saved page in a folder, as capture.ts does when it writes one, so
// pages saved before it did are cleaned too. publish.sh runs it on the fixtures repo before committing.
//
//   npx tsx e2e/sites/clean.ts ~/Projects/streambuddy-sites/captures
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { Capture } from "./replay"
import { feedsWithoutSecrets, JWT } from "./secrets"

const root = process.argv[2]
if (!root) throw new Error("give the folder of saved pages")
for (const state of await readdir(root)) {
	const dir = path.join(root, state)
	const page = await readFile(path.join(dir, "page.html"), "utf8").catch(() => null)
	if (page !== null) await writeFile(path.join(dir, "page.html"), page.replace(JWT, ""))
	const feeds = await readFile(path.join(dir, "feeds.json"), "utf8").catch(() => null)
	if (feeds === null) continue
	const cleaned = feedsWithoutSecrets(JSON.parse(feeds) as Capture["feeds"])
	await writeFile(path.join(dir, "feeds.json"), JSON.stringify(cleaned, null, "\t"))
}

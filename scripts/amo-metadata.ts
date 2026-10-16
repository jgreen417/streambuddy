// write the version metadata web-ext sign sends to addons.mozilla.org: the release notes from CHANGELOG.md
// and the confidential notes for Mozilla's reviewers: AMO_APPROVAL_NOTES if set, plus how to rebuild the package with
// streamBuddy's shared TMDb key (STREAMBUDDY_TMDB_KEY), without which their build would differ from the upload
// usage: tsx scripts/amo-metadata.ts <out.json>
import { readFileSync, writeFileSync } from "node:fs"
import process from "node:process"

const out = process.argv[2]
if (!out) throw new Error("usage: tsx scripts/amo-metadata.ts <out.json>")

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
const changelog = readFileSync("CHANGELOG.md", "utf8")
const heading = `# streamBuddy ${version}`
const start = changelog.indexOf(`${heading}\n`)
let releaseNotes = ""
if (start !== -1) {
	const rest = changelog.slice(start + heading.length + 1)
	const end = rest.search(/^# /m)
	releaseNotes = (end === -1 ? rest : rest.slice(0, end)).trim()
}

const metadata: { version: Record<string, unknown> } = { version: {} }
if (releaseNotes) metadata.version.release_notes = { "en-US": releaseNotes }
else console.warn(`No "${heading}" section in CHANGELOG.md, so the version goes up without release notes`)
const key = process.env.STREAMBUDDY_TMDB_KEY
if (!key) throw new Error("STREAMBUDDY_TMDB_KEY is missing: reviewers couldn't rebuild the package from source")
const buildNote =
	`To rebuild: npm ci, then STREAMBUDDY_TMDB_KEY=${key} npm run build:release:firefox. ` +
	"This is streamBuddy's shared TMDb API key, built into the package so ratings work without setup."
metadata.version.approval_notes = [process.env.AMO_APPROVAL_NOTES, buildNote].filter(Boolean).join("\n\n")

writeFileSync(out, JSON.stringify(metadata))
console.log(`Release notes: ${releaseNotes ? "yes" : "no"}, reviewer notes: yes`)

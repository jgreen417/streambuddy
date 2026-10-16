// write the version metadata web-ext sign sends to addons.mozilla.org: the release notes from CHANGELOG.md
// and, when AMO_APPROVAL_NOTES is set, the confidential notes for Mozilla's reviewers
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
if (process.env.AMO_APPROVAL_NOTES) metadata.version.approval_notes = process.env.AMO_APPROVAL_NOTES

writeFileSync(out, JSON.stringify(metadata))
console.log(
	`Release notes: ${releaseNotes ? "yes" : "no"}, reviewer notes: ${process.env.AMO_APPROVAL_NOTES ? "yes" : "no"}`,
)

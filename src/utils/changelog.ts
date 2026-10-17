// The one-line summary under a release's heading in CHANGELOG.md, if it has one, for the popup's "New in" note.
export function releaseSummary(changelog: string, version: string) {
	const section = changelog.split(/^# /m).find((part) => part.startsWith(`streamBuddy ${version}\n`))
	const line = section
		?.split("\n")
		.slice(1)
		.find((text) => text.trim())
	return line && !line.startsWith("-") ? line.trim() : ""
}

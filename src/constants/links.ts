// Public links shown in the extension. Leave DONATE_URL empty to hide every "Support" link.
export const DONATE_URL = "https://ko-fi.com/joshgreen48454"
export const SOURCE_URL = "https://github.com/jgreen417/streambuddy"
export const PRIVACY_URL = "https://github.com/jgreen417/streambuddy/blob/main/PRIVACY.md"
export const ISSUES_URL = "https://github.com/jgreen417/streambuddy/issues"
// Opened when someone removes the extension. Leave empty to open nothing.
export const UNINSTALL_SURVEY_URL =
	"https://docs.google.com/forms/d/e/1FAIpQLSc6RDYA-c6TPtOBYnCiKIM9pyP3BrCdyvNh2ZW7_isImqYcyw/viewform"

// A new bug report with the version and browser already filled in; the user sees it all before sending
export function bugReportUrl(version: string, userAgent: string) {
	const body = `**What happened?**

**Where?** The exact page URL (for example a Netflix title or search page)

**What did you expect?**

**Setup**
- streamBuddy version: ${version}
- Browser: ${userAgent}
- Country:

**Screenshot** (if it helps)
`
	const params = new URLSearchParams({ labels: "bug", title: "[Bug] ", body })
	return `${ISSUES_URL}/new?${params}`
}

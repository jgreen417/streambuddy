// The probe runs in the site's own page, which has no extension API (Dia's pages happen to carry one, a plain
// Chromium's don't). This stands in for it: every property and call answers with itself, so the extension code the
// site adapters pull in can load and wire its listeners without doing anything.
const nothing: unknown = new Proxy(function () {}, {
	get: (_, key) => (key === "then" || typeof key === "symbol" ? undefined : nothing),
	apply: () => nothing,
})
export { nothing as browser, nothing as default }

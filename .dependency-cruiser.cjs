/** streamBuddy's layering, checked in CI. Run: npx depcruise src --config .dependency-cruiser.cjs */
module.exports = {
	forbidden: [
		{ name: "no-circular", severity: "error", from: {}, to: { circular: true } },
		{
			name: "utils-are-leaf-logic",
			comment: "utils/ holds pure domain logic: it may use constants/ and other utils/, never app state, UI, or entry points",
			severity: "error",
			from: { path: "^src/utils/" },
			to: { path: "^src/(stores|composables|components|ui|content-script|playback|background)/", dependencyTypesNot: ["type-only"] },
		},
		{
			name: "stores-below-ui",
			severity: "error",
			from: { path: "^src/stores/" },
			to: { path: "^src/(components|ui|content-script|playback|background)/" },
		},
		{
			name: "ui-not-into-runtime",
			comment: "popup/options UI talks to content scripts and background only through messages and storage",
			severity: "error",
			from: { path: "^src/(components|ui)/" },
			to: { path: "^src/(content-script|background)/" },
		},
		{
			name: "background-is-standalone",
			severity: "error",
			from: { path: "^src/background/" },
			to: { path: "^src/(content-script|components|ui|playback|stores)/" },
		},
		{
			name: "shared-code-not-into-sites",
			comment: "only a service's own entry script may pick its site adapter; shared code receives it as a parameter",
			severity: "error",
			from: { path: "^src/(content-script/(?!sites/|netflix\\.ts|amazon\\.ts|max\\.ts)|playback/(?!sites/)|utils/)" },
			to: { path: "^src/(playback/sites/(netflix|prime|hbo)|content-script/sites/(netflix|prime|max))\\.ts$" },
		},
		{
			name: "entries-not-imported",
			severity: "error",
			from: {},
			to: { path: "^src/(content-script/(netflix|amazon|max)|background/index)\\.ts$" },
		},
		{
			name: "no-orphans",
			severity: "warn",
			from: { orphan: true, pathNot: ["\\.d\\.ts$", "^src/tests/", "\\.css$", "^src/ui/.*/pages/"] },
			to: {},
		},
	],
	options: {
		doNotFollow: { path: "node_modules" },
		exclude: { path: "^src/(tests|types)/" },
		tsConfig: { fileName: "tsconfig.json" },
		tsPreCompilationDeps: true,
		enhancedResolveOptions: { extensions: [".ts", ".vue", ".js", ".json"] },
	},
}

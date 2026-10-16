import { color, cssVariables, kebab } from "./tokens"

// tokens.css: every token as a --sb-* variable on :root, and the colours again as Tailwind colours (bg-sb-surface,
// text-sb-text-muted, ...) so utility classes and hand-written CSS draw from the same values
export function tokensCss() {
	const variables = Object.entries(cssVariables()).map(([name, value]) => `\t${name}: ${value};`)
	const tailwind = Object.keys(color).map((key) => `\t--color-sb-${kebab(key)}: var(--sb-${kebab(key)});`)
	return [
		"/* Written by npm run tokens from src/design/tokens.ts. Change the tokens there, not here. */",
		":root {",
		...variables,
		"}",
		"",
		"@theme inline {",
		...tailwind,
		"}",
		"",
	].join("\n")
}

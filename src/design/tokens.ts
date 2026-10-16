// streamBuddy's design tokens: every colour, typeface, shadow, radius and curve the extension draws with.
// This file is the only source. Extension pages read them as CSS variables from tokens.css (written from this file by
// npm run tokens); content scripts import them here, since a page's :root isn't ours to style. See docs/design-system.md.

// The "Buddy" palette, as RGB so any of it can be used at an alpha.
const RGB = {
	couch: [27, 25, 24],
	couchDeep: [21, 19, 18],
	popcorn: [251, 244, 236],
	tangerine: [255, 122, 69],
	white: [255, 255, 255],
	black: [0, 0, 0],
	seaGlass: [196, 228, 220],
	// the old borrowed Letterboxd green, still on the install page's welcome note
	legacyGreen: [0, 224, 84],
} as const satisfies Record<string, readonly [number, number, number]>
export type Tint = keyof typeof RGB

const hex = (name: Tint) => "#" + RGB[name].map((c) => c.toString(16).padStart(2, "0")).join("")
// a palette colour at an alpha, e.g. alpha("popcorn", 0.06) for the popup's surfaces
export function alpha(name: Tint, a: number) {
	return `rgba(${RGB[name].join(", ")}, ${a})`
}

export const palette = {
	couch: hex("couch"),
	couchDeep: hex("couchDeep"),
	// solid steps up from couch, for things that sit on a surface
	field: "#262220",
	well: "#2a2421",
	button: "#2b2724",
	line: "#3a3431",
	starEmpty: "#4a423e",
	scrollbar: "#5e5751",
	popcorn: hex("popcorn"),
	stone: "#a39b93",
	pebble: "#b3aaa1",
	sand: "#cfc6bc",
	cocoa: "#7a716a",
	tangerine: hex("tangerine"),
	apricot: "#ffb38f",
	sky: "#8ec5ff",
	denim: "#2f6fb5",
	mint: "#7ad9a0",
	sun: "#f2c94c",
	lilac: "#c9a7ff",
	coral: "#ff8a8a",
	blush: "#ffb8ad",
	red: "#ff5861",
	yellow: "#ffd23f",
	white: hex("white"),
} as const

// What each colour is for. These become the --sb-* variables (camelCase to kebab-case: textMuted is --sb-text-muted).
export const color = {
	// surfaces, darkest first
	bgDeep: palette.couchDeep,
	bg: palette.couch,
	field: palette.field,
	well: palette.well,
	button: palette.button,
	buttonHover: "#3a3430",
	surfaceSunken: alpha("popcorn", 0.04),
	hover: alpha("popcorn", 0.05),
	surface: alpha("popcorn", 0.06),
	track: alpha("popcorn", 0.06),
	surfaceRaised: alpha("popcorn", 0.1),
	surfaceHover: alpha("popcorn", 0.12),
	scrim: alpha("couch", 0.502),
	glassDark: alpha("couch", 0.86),
	panel: alpha("couch", 0.91),
	panelSolid: alpha("couch", 0.95),
	// lines
	divider: alpha("popcorn", 0.06),
	hairline: alpha("popcorn", 0.07),
	line: alpha("popcorn", 0.08),
	lineStrong: alpha("popcorn", 0.1),
	lineRaised: alpha("popcorn", 0.12),
	lineBright: alpha("popcorn", 0.14),
	lineField: alpha("popcorn", 0.15),
	lineHover: alpha("popcorn", 0.18),
	lineActive: alpha("popcorn", 0.28),
	lineOnMedia: alpha("white", 0.15),
	lineControl: alpha("white", 0.19),
	lineSolid: palette.line,
	// text
	text: palette.popcorn,
	textMuted: palette.stone,
	// quiet text shares the muted grey: anything darker failed WCAG AA contrast on the dark surfaces
	textQuiet: palette.stone,
	textSoft: palette.sand,
	textOnAccent: palette.couch,
	starEmpty: palette.starEmpty,
	scrollbar: palette.scrollbar,
	// the brand, and anything switched on
	accent: palette.tangerine,
	accentWash: alpha("tangerine", 0.1),
	accentWashHover: alpha("tangerine", 0.16),
	accentGlow: alpha("tangerine", 0.25),
	accentLine: alpha("tangerine", 0.35),
	focus: palette.apricot,
	focusQuiet: alpha("popcorn", 0.4),
	// signals
	up: palette.mint,
	info: palette.sky,
	danger: palette.coral,
	dangerSoft: palette.blush,
	error: palette.red,
	textOnError: palette.white,
	warning: palette.yellow,
	welcomeWash: alpha("legacyGreen", 0.1),
	welcomeLine: alpha("legacyGreen", 0.25),
	// the rating badge: a popcorn sticker with dark ink (Liquid Glass swaps these on the badge itself)
	badgeBg: palette.popcorn,
	badgeInk: palette.couch,
	badgeLabel: palette.cocoa,
	badgeWatchlist: palette.denim,
	badgeUnrated: palette.pebble,
	dimOverlay: "rgba(40, 40, 40, 0.7)",
} as const

// Rating colour bands, red to green (ratings.ts picks the band). Softened so a score reads as a pill of colour with
// dark text on it, and still as coloured text on the dark panels. Colour on a badge always means score.
export const scoreScale = ["#ff8a7a", "#ffb168", "#f2c94c", "#b5e07a", "#7ad9a0"] as const

// Friends' faces and dots, picked by name so a friend keeps their colour from card to credits.
// The first three are also the fixed trio.
export const friendColors = [palette.tangerine, palette.sky, palette.sun, palette.mint, palette.lilac] as const

// Each service's own brand colour, for the watch-time chart.
export const serviceColors: Record<string, string> = {
	netflix: "#e50914",
	amazon: "#1f9cf0",
	hbo: "#7b5cff",
}

// Liquid Glass: light text on a blurred, lightly tinted pane. The pane's tint and blur come from the frost setting.
export const glass = {
	ink: palette.white,
	label: alpha("white", 0.8),
	watchlist: palette.sky,
	chip: alpha("white", 0.6),
	edge: `inset 0 0 0 0.5px ${alpha("white", 0.55)}, inset 0 1px 0 ${alpha("white", 0.5)}`,
	textShadow: `0 1px 2px ${alpha("black", 0.35)}`,
	sample: `linear-gradient(135deg, ${alpha("popcorn", 0.28)}, ${alpha("seaGlass", 0.18)})`,
	slider: `linear-gradient(90deg, ${alpha("popcorn", 0.08)}, ${alpha("seaGlass", 0.85)})`,
	sliderEdge: `inset 0 0 0 0.5px ${alpha("white", 0.4)}`,
} as const

export const shadow = {
	// a sticker, not glass: a hard drop shadow lifts the badge off any artwork
	sticker: `0 3px 0 ${alpha("black", 0.35)}`,
	stickerSmall: `0 2px 0 ${alpha("black", 0.35)}`,
	glass: `${glass.edge}, 0 2px 8px ${alpha("black", 0.25)}`,
	glassSmall: `${glass.edge}, 0 2px 6px ${alpha("black", 0.25)}`,
	float: `0 8px 28px ${alpha("black", 0.45)}`,
	review: `0 12px 30px ${alpha("black", 0.533)}`,
	reviewLifted: `0 16px 40px ${alpha("black", 0.6)}`,
	insetLine: `inset 0 0 0 1px ${alpha("popcorn", 0.06)}`,
	insetLineRaised: `inset 0 0 0 1px ${alpha("popcorn", 0.125)}`,
} as const

// Bricolage Grotesque everywhere. Extension pages load it from @fontsource; on streaming sites the badge and credits
// pill load the bundled file under streamBuddy's own family name (page-feature-styles.ts) so it can't clash.
const SYSTEM = `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
const PAGE_FAMILY = '"streamBuddy Bricolage"'
export const font = {
	ui: `"Bricolage Grotesque Variable", "Bricolage Grotesque", ${SYSTEM}`,
	pageFamily: PAGE_FAMILY,
	page: `${PAGE_FAMILY}, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif`,
	system: SYSTEM,
	mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

export const radius = {
	xs: "5px",
	sm: "6px",
	md: "8px",
	lg: "10px",
	xl: "12px",
	pill: "999px",
} as const

export const ease = {
	// the popup's tabs, the badge settling in, bars growing
	settle: "cubic-bezier(0.3, 0.7, 0.2, 1)",
	// the credits pill opening and closing
	unfold: "cubic-bezier(0.3, 0.7, 0.1, 1)",
	// the credits pill arriving
	arrive: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const

export const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())
// every token as CSS custom properties: --sb-text, --sb-radius-md, --sb-shadow-sticker, --sb-ease-settle, ...
export function cssVariables(): Record<string, string> {
	const groups: [string, Record<string, string>][] = [
		["", color],
		["glass-", glass],
		["shadow-", shadow],
		["font-", font],
		["radius-", radius],
		["ease-", ease],
	]
	return Object.fromEntries(
		groups.flatMap(([prefix, tokens]) =>
			Object.entries(tokens).map(([key, value]) => [`--sb-${prefix}${kebab(key)}`, value]),
		),
	)
}
// the same as one declaration list, for a scoped style block
export function cssDeclarations() {
	return Object.entries(cssVariables())
		.map(([name, value]) => `${name}:${value};`)
		.join(" ")
}

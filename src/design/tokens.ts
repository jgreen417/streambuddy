// streamBuddy's design tokens: every colour, typeface, shadow, radius, space and curve the extension draws with.
// This file is the only source. Extension pages read them as CSS variables from tokens.css (written from this file by
// npm run tokens); content scripts import them here, since a page's :root isn't ours to style. See docs/design-system.md.

// The "Buddy" palette, as RGB so any of it can be used at an alpha.
const RGB = {
	couch: [27, 25, 24],
	couchDeep: [21, 19, 18],
	popcorn: [251, 244, 236],
	tangerine: [255, 122, 69],
	clay: [227, 128, 86],
	white: [255, 255, 255],
	black: [0, 0, 0],
	seaGlass: [196, 228, 220],
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
	// the accent: a calmer tangerine, so the logo stays the brightest orange on screen
	clay: hex("clay"),
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
	// what's selected (the active tab, the picked option): a soft lighter step, never a solid fill
	selected: alpha("popcorn", 0.12),
	glassDark: alpha("couch", 0.86),
	panel: alpha("couch", 0.91),
	// smoked glass: the credits card and the hover card, over the video or the artwork (with --sb-blur-panel)
	glassPanel: alpha("couch", 0.78),
	lineGlass: alpha("white", 0.1),
	wellGlass: alpha("white", 0.06),
	panelSolid: alpha("couch", 0.95),
	// lines
	hairline: alpha("popcorn", 0.07),
	lineRaised: alpha("popcorn", 0.12),
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
	// the main action on each screen, links and stars; the logo keeps the brighter tangerine
	accent: palette.clay,
	accentWash: alpha("clay", 0.1),
	accentWashHover: alpha("clay", 0.16),
	accentGlow: alpha("clay", 0.25),
	accentLine: alpha("clay", 0.35),
	// a switch that's on: popcorn with a dark knob, so a row of switches doesn't turn the popup orange
	switchOn: palette.popcorn,
	switchKnobOn: palette.couch,
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
	// the rating badge: smoked glass with popcorn text (with --sb-blur-badge; Liquid Glass swaps these on the badge itself)
	badgeBg: alpha("couchDeep", 0.74),
	badgeInk: palette.popcorn,
	badgeLabel: alpha("popcorn", 0.85),
	badgeWatchlist: palette.sky,
	// a score is always dark on its band colour
	scoreInk: palette.couch,
	badgeUnrated: palette.pebble,
	dimOverlay: "rgba(40, 40, 40, 0.7)",
} as const

// Rating colour bands, red to green (ratings.ts picks the band). Softened so a score reads as a pill of colour with
// dark text on it, and still as coloured text on the dark panels. Colour on a badge always means score.
export const scoreScale = ["#f1a99e", "#e2b38b", "#d3bc7b", "#aec88f", "#97ccaa"] as const

// Friends' faces and dots, picked by name so a friend keeps their colour from card to credits.
// The first three are also the fixed trio.
export const friendColors = [palette.tangerine, palette.sky, palette.sun, palette.mint, palette.lilac] as const

// The watch-time chart's services, most watched first: popcorn down to grey, one step per service, each at least 3:1 on
// the popup so a slice never disappears.
export const chartSteps = [palette.popcorn, palette.sand, palette.stone, "#8a827b", "#776f69", "#655e59"] as const

// Each service's own brand colour, for the service chips on the hover card.
export const serviceColors: Record<string, string> = {
	netflix: "#e50914",
	amazon: "#1f9cf0",
	hbo: "#7b5cff",
	disney: "#0f6cf2",
	crunchyroll: "#f47521",
	tubi: "#ffdf00",
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
	// smoked glass: a faint light edge and a soft shadow lift the badge off any artwork
	badge: `inset 0 0 0 0.5px ${alpha("white", 0.2)}, inset 0 1px 0 ${alpha("white", 0.12)}, 0 2px 10px ${alpha("black", 0.3)}`,
	badgeSmall: `inset 0 0 0 0.5px ${alpha("white", 0.2)}, 0 1px 4px ${alpha("black", 0.3)}`,
	panel: `inset 0 1px 0 ${alpha("white", 0.08)}, 0 20px 50px ${alpha("black", 0.45)}`,
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
	xxs: "2px",
	xs: "5px",
	sm: "6px",
	md: "8px",
	lg: "10px",
	xl: "12px",
	pill: "999px",
	// the credits pill, closed (half its height) and opened into a card
	credits: "30px",
	creditsOpen: "22px",
} as const

export const space = {
	xxs: "2px",
	xs: "4px",
	sm: "6px",
	md: "8px",
	lg: "12px",
	xl: "16px",
	// the popup's and the credits pill's outer edge
	edge: "14px",
	// from a group's border to its content
	inset: "12px",
	// above the credits card's content
	card: "18px",
} as const

// backdrop-filter values for the smoked glass
export const blur = {
	badge: "blur(14px) saturate(1.5)",
	panel: "blur(28px) saturate(1.4)",
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
// every token as CSS custom properties: --sb-text, --sb-radius-md, --sb-shadow-badge, --sb-ease-settle, ...
export function cssVariables(): Record<string, string> {
	const groups: [string, Record<string, string>][] = [
		["", color],
		["glass-", glass],
		["shadow-", shadow],
		["blur-", blur],
		["font-", font],
		["radius-", radius],
		["space-", space],
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

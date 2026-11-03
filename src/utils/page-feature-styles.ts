import { alpha, cssDeclarations, font, glass, shadow } from "@/design/tokens"
import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2?url"
import type { BadgeStyle } from "@/stores/storeTypes"

// The badge's typeface, served from the extension itself (no request leaves the browser). The family name is
// streamBuddy's own so it can't clash with a font the site loads.
export const BADGE_FONT = font.pageFamily

// Declared on the document so it also reaches the player overlay's shadow root (a shadow root can't declare fonts).
export function installPageFont() {
	if (document.getElementById("sb-page-font")) return
	const style = document.createElement("style")
	style.id = "sb-page-font"
	style.textContent = `@font-face { font-family:${BADGE_FONT}; src:url("${browser.runtime.getURL(bricolageLatin)}") format("woff2"); font-weight:200 800; font-display:swap; }`
	document.head.append(style)
}

// Scoped to streamBuddy's injected controls; avoid styling the host site's UI. The design tokens are set on each of
// those controls rather than on the page's :root.
export function installPageFeatureStyle() {
	if (document.getElementById("sb-page-features-style")) return
	installPageFont()
	const style = document.createElement("style")
	style.id = "sb-page-features-style"
	style.textContent = `
 .sb-review, .sb-feature-button, .sb-hide-title, .sb-episode-rating, .sb-card-rating, .sb-shortcut-notice { ${cssDeclarations()} }
 .sb-review { color:var(--sb-text); font:14px/1.5 var(--sb-font-system); }
 .sb-feature-button { display:inline-flex; align-items:center; justify-content:center; min-height:40px; box-sizing:border-box; cursor:pointer; padding:8px 12px; background:var(--sb-button); color:var(--sb-text); border:1px solid var(--sb-line-control); border-radius:var(--sb-radius-md); font:500 13px/1.4 var(--sb-font-system); }
 .sb-feature-button:hover:not(:disabled) { background:var(--sb-button-hover); } .sb-feature-button:disabled { cursor:default; opacity:.65; }
 .sb-hide-title:focus-visible,.sb-card-rating:focus-visible,.sb-feature-button:focus-visible,.sb-episode-rating:focus-visible,.sb-review a:focus-visible,.sb-review button:focus-visible { outline:2px solid var(--sb-focus); outline-offset:3px; }
 .sb-episode-host { position:relative !important; }
 /* the card badge on an episode: smoked glass with the score in its colour band and the source beside it, its
    corners following the thumbnail's (set by page-features.ts) like the card badge's */
 .sb-episode-rating { position:absolute; right:3px; bottom:3px; z-index:4; display:flex; align-items:center; padding:3px; border-radius:var(--sb-badge-r,var(--sb-radius-xxs)); background:var(--sb-badge-bg); color:var(--sb-badge-label); box-shadow:var(--sb-shadow-badge); -webkit-backdrop-filter:var(--sb-blur-badge); backdrop-filter:var(--sb-blur-badge); font:700 clamp(13px,0.95vw,17px)/1 var(--sb-font-page); font-variant-numeric:tabular-nums; text-decoration:none; white-space:nowrap; }
 .sb-episode-score { padding:.28em .6em; border-radius:var(--sb-pill-r,var(--sb-radius-xxs)); color:var(--sb-text-on-accent); font-size:1.15em; font-weight:800; letter-spacing:-.02em; text-shadow:none; }
 .sb-episode-source { padding:0 .5em 0 .45em; font-size:max(10px,.72em); font-weight:800; }
 .sb-episode-best { padding:0 .45em 0 .35em; color:var(--sb-accent); font-size:.95em; line-height:1; }
 .sb-hide-title { position:absolute; top:4px; right:4px; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid var(--sb-line-control); border-radius:var(--sb-radius-md); background:var(--sb-panel); color:var(--sb-text); font:22px/1 var(--sb-font-system); cursor:pointer; z-index:10; }
 .sb-hide-title:hover { background:var(--sb-button-hover); }
 .sb-search-sort { margin:12px 0; } .sb-search-sort[aria-pressed="true"] { border-color:var(--sb-focus); }
 .sb-review { position:fixed; right:var(--sb-review-right,16px); bottom:var(--sb-review-bottom,90px); z-index:2147483647; display:flex; flex-direction:column; gap:var(--sb-space-md); width:400px; max-width:calc(100vw - 32px); box-sizing:border-box; font-family:var(--sb-font-page); }
 .sb-review { animation:sb-review-in .32s var(--sb-ease-arrive) both; }
 @keyframes sb-review-in { from { opacity:0; transform:translateY(10px) scale(.98); } }
 @keyframes sb-review-in-down { from { opacity:0; transform:translateY(-10px) scale(.98); } }
 .sb-review-left { right:auto; left:var(--sb-review-left,max(16px,3vw)); }
 .sb-review-top { bottom:auto; top:var(--sb-review-top,80px); right:var(--sb-review-right,16px); flex-direction:column-reverse; animation-name:sb-review-in-down; }
 .sb-review *, .sb-review *::before, .sb-review *::after { box-sizing:border-box; }
 .sb-review svg { display:block; flex:none; }
 :where(.sb-review) button { font:inherit; color:inherit; cursor:pointer; }
 .sb-review a { color:inherit; text-decoration:none; }
 .sb-review-shell { display:grid; grid-template-columns:minmax(0,1fr); grid-template-rows:0fr auto; overflow:hidden; border:1px solid var(--sb-line-glass); border-radius:var(--sb-radius-credits); background:var(--sb-glass-panel); -webkit-backdrop-filter:var(--sb-blur-panel); backdrop-filter:var(--sb-blur-panel); box-shadow:var(--sb-shadow-panel); transition:grid-template-rows .38s var(--sb-ease-unfold),border-radius .38s var(--sb-ease-unfold),border-color .15s; }
 .sb-review-shell:hover, .sb-review-open .sb-review-shell { border-color:var(--sb-line-hover); }
 .sb-review-open .sb-review-shell { grid-template-rows:1fr auto; border-radius:var(--sb-radius-credits-open); }
 .sb-review-top .sb-review-shell { grid-template-rows:auto 0fr; }
 .sb-review-top.sb-review-open .sb-review-shell { grid-template-rows:auto 1fr; }
 .sb-review-top .sb-review-card { order:2; grid-row:2; }
 .sb-review-pill { display:flex; align-items:center; gap:var(--sb-space-lg); height:60px; padding:0 var(--sb-space-edge); }
 .sb-review-toggle { display:flex; align-items:center; gap:var(--sb-space-lg); flex:1; min-width:0; height:100%; padding:0; border:0; background:none; text-align:left; }
 .sb-review-toggle > svg { width:38px; height:38px; }
 .sb-review-text { display:flex; flex-direction:column; min-width:0; flex:1; line-height:1.2; }
 .sb-review-text b { font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
 .sb-review-sub { font-size:13px; color:var(--sb-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
 .sb-review-faces { display:flex; flex:none; transition:opacity .2s; }
 .sb-review-open .sb-review-faces, .sb-review-open .sb-review-toggle .sb-review-score { opacity:0; }
 .sb-review-toggle .sb-review-score { transition:opacity .2s; }
 .sb-review-face { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:28px; border-radius:50%; border:2px solid var(--sb-bg); color:var(--sb-text-on-accent); font-size:12px; font-weight:700; }
 .sb-review-faces .sb-review-face + .sb-review-face { margin-left:-9px; }
 .sb-review-score { flex:none; padding:var(--sb-space-xs) var(--sb-space-md); border-radius:var(--sb-radius-md); color:var(--sb-text-on-accent); font-size:15px; font-weight:800; }
 .sb-review-stars { color:var(--sb-accent); letter-spacing:1px; white-space:nowrap; }
 .sb-review-stars s { color:var(--sb-star-empty); text-decoration:none; }
 /* keep filled, half and empty stars apart in forced-colors mode, where they would all become one text colour */
 @media (forced-colors:active) { .sb-review-stars { forced-color-adjust:none; } }
 .sb-review-half { font-style:normal; color:transparent; background:linear-gradient(90deg,var(--sb-accent) 50%,var(--sb-star-empty) 50%); -webkit-background-clip:text; background-clip:text; }
 .sb-review-sub .sb-review-stars { font-size:13px; }
 .sb-review-action { flex:none; padding:var(--sb-space-md) var(--sb-space-lg); border:1px solid transparent; border-radius:var(--sb-radius-pill); background:var(--sb-accent); color:var(--sb-text-on-accent) !important; font-size:14px; font-weight:700; white-space:nowrap; }
 .sb-review-open .sb-review-action { visibility:hidden; }
 .sb-review-ghost { background:transparent; border-color:var(--sb-line-hover); color:var(--sb-text) !important; font-weight:500; }
 .sb-review-chevron { display:flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; padding:0; border:0; border-radius:50%; background:var(--sb-well-glass); color:var(--sb-text-muted); }
 .sb-review-chevron svg { width:16px; height:16px; transition:transform .38s var(--sb-ease-unfold); }
 .sb-review-top .sb-review-chevron svg { transform:rotate(180deg); }
 .sb-review-shell:hover .sb-review-chevron, .sb-review-chevron:hover { background:var(--sb-selected); color:var(--sb-text); }
 .sb-review-card { min-height:0; overflow:hidden; }
 .sb-review-card-inner { padding:var(--sb-space-card) var(--sb-space-edge); opacity:0; transform:translateY(8px); transition:opacity .2s ease,transform .2s ease; }
 .sb-review-top .sb-review-card-inner { transform:translateY(-8px); }
 .sb-review-open .sb-review-card-inner { opacity:1; transform:none; transition-delay:.16s; transition-duration:.26s; }
 /* open, the card takes the pill's place */
 .sb-review-open .sb-review-pill { display:none; }
 .sb-review-head { display:flex; align-items:flex-start; gap:var(--sb-space-lg); }
 .sb-review-collapse { flex:none; margin:-6px -6px 0 auto; width:36px; height:36px; padding:0; border:0; border-radius:50%; background:none; color:var(--sb-text-muted); font-size:24px; line-height:1; }
 .sb-review-collapse:hover { background:var(--sb-well-glass); color:var(--sb-text); }
 .sb-review-heading { margin:0; font-size:22px; font-weight:800; line-height:1.15; letter-spacing:-.2px; overflow-wrap:anywhere; min-width:0; }
 .sb-review-subhead { margin-top:var(--sb-space-xs); color:var(--sb-text-muted); font-size:13px; }
 .sb-review-subhead b { color:var(--sb-text); font-weight:700; }
 .sb-review-section { margin-top:var(--sb-space-edge); }
 .sb-review-friend { display:flex; align-items:center; gap:var(--sb-space-lg); margin-bottom:var(--sb-space-sm); font-size:15px; }
 .sb-review-average + .sb-review-friend { margin:var(--sb-space-md) 0 0; }
 .sb-review-friend .sb-review-stars { margin-left:auto; font-size:14px; }
 .sb-review-average { display:flex; align-items:center; gap:var(--sb-space-lg); font-size:15px; }
 .sb-review-more { display:block; margin-top:var(--sb-space-sm); color:var(--sb-text-muted) !important; font-size:13px; }
 a.sb-review-more:hover { color:var(--sb-text) !important; }
 .sb-review-note { margin:var(--sb-space-md) 0 0; color:var(--sb-text-soft); font-size:14px; line-height:1.4; }
 .sb-review-buttons { display:flex; align-items:center; gap:var(--sb-space-md); margin-top:var(--sb-space-xl); }
 .sb-review-primary { display:flex; flex:1; align-items:center; justify-content:center; min-height:44px; padding:var(--sb-space-md) var(--sb-space-lg); border:0; border-radius:var(--sb-radius-xl); background:var(--sb-accent); color:var(--sb-text-on-accent) !important; font-size:15px; font-weight:700; text-align:center; }
 .sb-review-later { flex:none; min-height:44px; padding:0 var(--sb-space-lg); border:0; border-radius:var(--sb-radius-xl); background:none; color:var(--sb-text-muted) !important; font-size:15px; font-weight:500; }
 .sb-review-later:hover { background:var(--sb-well-glass); color:var(--sb-text) !important; }
 .sb-review-rate { margin:var(--sb-space-lg) 0 0; color:var(--sb-text-muted); font-size:12px; text-align:center; }
 .sb-review-rate a { color:var(--sb-accent) !important; font-weight:700; }
 .sb-shortcut-notice { position:fixed; left:50%; bottom:48px; z-index:2147483647; transform:translateX(-50%); padding:10px 18px; border:1px solid var(--sb-line-glass); border-radius:var(--sb-radius-pill); background:var(--sb-glass-panel); -webkit-backdrop-filter:var(--sb-blur-panel); backdrop-filter:var(--sb-blur-panel); box-shadow:var(--sb-shadow-float); color:var(--sb-text); font:600 14px/1.3 var(--sb-font-page); white-space:nowrap; pointer-events:none; }
 @media (prefers-reduced-motion:reduce) { .sb-review, .sb-review *, .sb-feature-button,.sb-episode-rating,.sb-card-rating,.sb-hide-title { animation:none !important; transition:none !important; } }
 `
	document.head.append(style)
}

// How card badges and episode chips look, picked once from the settings and handed to whatever draws them.
// id changes whenever the look does, so drawn chips can tell they're out of date.
export type BadgeLook = { id: string; apply(el: HTMLElement): void }
export const classicLook: BadgeLook = { id: "classic", apply: () => {} }
export function badgeLook({ badgeStyle, glassFrost }: { badgeStyle: BadgeStyle; glassFrost: number }): BadgeLook {
	if (badgeStyle !== "glass") return classicLook
	return { id: `glass-${glassFrost}`, apply: (el) => applyGlass(el, glassFrost) }
}

// Liquid Glass: a blurred, lightly tinted pane in place of the cream chip, with light text. frost runs from
// 0 (clear glass: a hairline edge and highlight) to 100 (thick frosted sea glass). The score pill keeps its colour.
function applyGlass(div: HTMLElement, frost: number) {
	const f = Math.min(Math.max(frost, 0), 100) / 100
	Object.assign(div.style, {
		background: alpha("popcorn", +(0.04 + 0.26 * f).toFixed(2)),
		backdropFilter: `blur(${(2 + 14 * f).toFixed(1)}px) saturate(1.6)`,
		boxShadow: shadow.glass,
		textShadow: glass.textShadow,
	})
	div.style.setProperty("--sb-badge-ink", glass.ink)
	div.style.setProperty("--sb-badge-label", glass.label)
	div.style.setProperty("--sb-badge-watchlist", glass.watchlist)
	div.style.setProperty("--sb-badge-bg", glass.chip)
}

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
 .sb-review, .sb-feature-button, .sb-hide-title, .sb-episode-rating, .sb-card-rating { ${cssDeclarations()} }
 .sb-review { color:var(--sb-text); font:14px/1.5 var(--sb-font-system); }
 .sb-feature-button { display:inline-flex; align-items:center; justify-content:center; min-height:40px; box-sizing:border-box; cursor:pointer; padding:8px 12px; background:var(--sb-button); color:var(--sb-text); border:1px solid var(--sb-line-control); border-radius:var(--sb-radius-md); font:500 13px/1.4 var(--sb-font-system); }
 .sb-feature-button:hover:not(:disabled) { background:var(--sb-button-hover); } .sb-feature-button:disabled { cursor:default; opacity:.65; }
 .sb-hide-title:focus-visible,.sb-card-rating:focus-visible,.sb-feature-button:focus-visible,.sb-episode-rating:focus-visible,.sb-review a:focus-visible,.sb-review button:focus-visible { outline:2px solid var(--sb-focus); outline-offset:3px; }
 .sb-episode-host { position:relative !important; }
 /* the card badge on an episode: a cream sticker with the score in its colour band and the source beside it, its
    corners following the thumbnail's (set by page-features.ts) like the card badge's */
 .sb-episode-rating { position:absolute; right:3px; bottom:3px; z-index:4; display:flex; align-items:center; padding:3px; border-radius:var(--sb-badge-r,var(--sb-radius-xxs)); background:var(--sb-badge-bg); color:var(--sb-badge-label); box-shadow:var(--sb-shadow-sticker); font:700 clamp(13px,0.95vw,17px)/1 var(--sb-font-page); font-variant-numeric:tabular-nums; text-decoration:none; white-space:nowrap; }
 .sb-episode-score { padding:.28em .6em; border-radius:var(--sb-pill-r,var(--sb-radius-xxs)); color:var(--sb-text-on-accent); font-size:1.15em; font-weight:800; letter-spacing:-.02em; text-shadow:none; }
 .sb-episode-source { padding:0 .5em 0 .45em; font-size:max(10px,.72em); font-weight:800; }
 .sb-hide-title { position:absolute; top:4px; right:4px; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid var(--sb-line-control); border-radius:var(--sb-radius-md); background:var(--sb-panel); color:var(--sb-text); font:22px/1 var(--sb-font-system); cursor:pointer; z-index:10; }
 .sb-hide-title:hover { background:var(--sb-button-hover); }
 .sb-search-sort { margin:12px 0; } .sb-search-sort[aria-pressed="true"] { border-color:var(--sb-focus); }
 .sb-review { position:fixed; right:16px; bottom:90px; z-index:2147483647; display:flex; flex-direction:column; gap:var(--sb-space-md); width:400px; max-width:calc(100vw - 32px); box-sizing:border-box; font-family:var(--sb-font-page); }
 .sb-review { animation:sb-review-in .32s var(--sb-ease-arrive) both; }
 @keyframes sb-review-in { from { opacity:0; transform:translateY(10px) scale(.98); } }
 @keyframes sb-review-in-down { from { opacity:0; transform:translateY(-10px) scale(.98); } }
 .sb-review-left { right:auto; left:var(--sb-review-left,max(16px,3vw)); }
 .sb-review-top { bottom:auto; top:80px; flex-direction:column-reverse; animation-name:sb-review-in-down; }
 .sb-review *, .sb-review *::before, .sb-review *::after { box-sizing:border-box; }
 .sb-review svg { display:block; flex:none; }
 :where(.sb-review) button { font:inherit; color:inherit; cursor:pointer; }
 .sb-review a { color:inherit; text-decoration:none; }
 .sb-review-shell { display:grid; grid-template-rows:0fr auto; overflow:hidden; border:1px solid var(--sb-line-solid); border-radius:var(--sb-radius-credits); background:var(--sb-bg); box-shadow:var(--sb-shadow-review); transition:grid-template-rows .38s var(--sb-ease-unfold),border-radius .38s var(--sb-ease-unfold),border-color .15s,box-shadow .15s; }
 .sb-review-shell:hover, .sb-review-open .sb-review-shell { border-color:var(--sb-accent); box-shadow:0 0 0 3px var(--sb-accent-glow),var(--sb-shadow-review-lifted); }
 .sb-review-open .sb-review-shell { grid-template-rows:1fr auto; border-radius:var(--sb-radius-credits-open); }
 .sb-review-top .sb-review-shell { grid-template-rows:auto 0fr; }
 .sb-review-top.sb-review-open .sb-review-shell { grid-template-rows:auto 1fr; }
 .sb-review-top .sb-review-card { order:2; }
 .sb-review-pill { display:flex; align-items:center; gap:var(--sb-space-lg); height:60px; padding:0 var(--sb-space-edge); }
 .sb-review-toggle { display:flex; align-items:center; gap:var(--sb-space-lg); flex:1; min-width:0; height:100%; padding:0; border:0; background:none; text-align:left; }
 .sb-review-toggle > svg { width:38px; height:38px; }
 .sb-review-text { display:flex; flex-direction:column; min-width:0; flex:1; line-height:1.2; }
 .sb-review-text b { font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
 .sb-review-sub { font-size:13px; color:var(--sb-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
 .sb-review-faces { display:flex; flex:none; transition:opacity .2s; }
 .sb-review-open .sb-review-faces { opacity:0; }
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
 .sb-review-ghost { background:transparent; border-color:var(--sb-line-solid); color:var(--sb-text) !important; font-weight:500; }
 .sb-review-chevron { display:flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; padding:0; border:0; border-radius:50%; background:var(--sb-well); color:var(--sb-text-muted); }
 .sb-review-chevron svg { width:16px; height:16px; transition:transform .38s var(--sb-ease-unfold); }
 .sb-review-open .sb-review-chevron svg, .sb-review-top .sb-review-chevron svg { transform:rotate(180deg); }
 .sb-review-top.sb-review-open .sb-review-chevron svg { transform:none; }
 .sb-review-shell:hover .sb-review-chevron, .sb-review-chevron:hover { background:var(--sb-accent); color:var(--sb-text-on-accent); }
 .sb-review-card { min-height:0; overflow:hidden; }
 .sb-review-card-inner { padding:var(--sb-space-card) var(--sb-space-edge) 0; opacity:0; transform:translateY(8px); transition:opacity .2s ease,transform .2s ease; }
 .sb-review-card-inner::after { content:""; display:block; height:1px; margin-top:var(--sb-space-edge); background:var(--sb-line-solid); }
 .sb-review-top .sb-review-card-inner { padding:0 var(--sb-space-edge) var(--sb-space-card); transform:translateY(-8px); }
 .sb-review-top .sb-review-card-inner::after { display:none; }
 .sb-review-top .sb-review-card-inner::before { content:""; display:block; height:1px; margin-bottom:var(--sb-space-edge); background:var(--sb-line-solid); }
 .sb-review-open .sb-review-card-inner { opacity:1; transform:none; transition-delay:.16s; transition-duration:.26s; }
 .sb-review-head { display:flex; align-items:center; gap:var(--sb-space-lg); font-weight:700; }
 .sb-review-head svg { width:24px; height:24px; }
 .sb-review-close { margin-left:auto; width:36px; height:36px; padding:0; border:0; border-radius:50%; background:none; color:var(--sb-text-muted); font-size:24px; line-height:1; }
 .sb-review-close:hover { background:var(--sb-well); color:var(--sb-text); }
 .sb-review-heading { margin:var(--sb-space-md) 0 var(--sb-space-xxs); font-size:22px; font-weight:800; line-height:1.15; letter-spacing:-.2px; overflow-wrap:anywhere; }
 .sb-review-section { margin-top:var(--sb-space-edge); padding-top:var(--sb-space-lg); border-top:1px solid var(--sb-line-solid); }
 .sb-review-label { margin-bottom:var(--sb-space-md); padding:0 var(--sb-space-inset); color:var(--sb-text-muted); font-size:12px; letter-spacing:1.2px; text-transform:uppercase; }
 .sb-review-friend { display:flex; align-items:center; gap:var(--sb-space-lg); margin-bottom:var(--sb-space-md); padding:0 var(--sb-space-inset); font-size:15px; }
 .sb-review-average + .sb-review-friend { margin:var(--sb-space-md) 0 0; }
 .sb-review-friend .sb-review-stars { margin-left:auto; font-size:14px; }
 .sb-review-average { display:flex; align-items:center; gap:var(--sb-space-lg); padding:var(--sb-space-md) var(--sb-space-inset); border-radius:var(--sb-radius-xl); background:var(--sb-well); font-size:15px; }
 .sb-review-more { margin-left:auto; color:var(--sb-text-muted) !important; font-size:13px; }
 .sb-review-note { margin:var(--sb-space-md) 0 0; padding:0 var(--sb-space-inset); color:var(--sb-text-soft); font-size:14px; line-height:1.4; }
 .sb-review-buttons { display:flex; gap:var(--sb-space-lg); margin-top:var(--sb-space-edge); }
 .sb-review-primary, .sb-review-secondary { display:flex; flex:1; align-items:center; justify-content:center; min-height:44px; padding:var(--sb-space-md) var(--sb-space-lg); border-radius:var(--sb-radius-xl); font-size:15px; font-weight:700; text-align:center; }
 .sb-review-primary { border:0; background:var(--sb-accent); color:var(--sb-text-on-accent) !important; }
 .sb-review-secondary { border:1px solid var(--sb-line-solid); background:transparent; color:var(--sb-text) !important; font-weight:500; }
 .sb-review-footnote { margin:var(--sb-space-lg) 0 0; color:var(--sb-text-muted); font-size:12px; text-align:center; }
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

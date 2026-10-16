import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2?url"

// The badge's typeface, served from the extension itself (no request leaves the browser). The family name is
// streamBuddy's own so it can't clash with a font the site loads.
export const BADGE_FONT = '"streamBuddy Bricolage"'

// Scoped to streamBuddy's injected controls; avoid styling the host site's UI.
export function installPageFeatureStyle() {
	if (document.getElementById("sb-page-features-style")) return
	const style = document.createElement("style")
	style.id = "sb-page-features-style"
	style.textContent = `
 @font-face { font-family:${BADGE_FONT}; src:url("${browser.runtime.getURL(bricolageLatin)}") format("woff2"); font-weight:200 800; font-display:swap; }
 .sb-review { --sb-feature-bg:#1b1918f2; --sb-feature-text:#fbf4ec; --sb-feature-muted:#cfc6bc; --sb-feature-line:#ffffff26; color:var(--sb-feature-text); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
 .sb-feature-button { display:inline-flex; align-items:center; justify-content:center; min-height:40px; box-sizing:border-box; cursor:pointer; padding:8px 12px; background:#2b2724; color:#fbf4ec; border:1px solid #ffffff30; border-radius:8px; font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
 .sb-feature-button:hover:not(:disabled) { background:#3a3430; } .sb-feature-button:disabled { cursor:default; opacity:.65; }
 .sb-hide-title:focus-visible,.sb-card-rating:focus-visible,.sb-feature-button:focus-visible,.sb-episode-rating:focus-visible,.sb-review a:focus-visible,.sb-review button:focus-visible { outline:2px solid #ffb38f; outline-offset:3px; }
 .sb-episode-host { position:relative !important; } .sb-episode-rating { position:absolute; right:6px; bottom:6px; z-index:4; padding:5px 8px; border:1px solid #ffffff26; border-radius:6px; background:#1b1918f2; color:#fff; font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; text-decoration:none; }
 .sb-hide-title { position:absolute; top:4px; right:4px; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #ffffff30; border-radius:8px; background:#1b1918e8; color:#fbf4ec; font:22px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; cursor:pointer; z-index:10; }
 .sb-hide-title:hover { background:#3a3430; }
 .sb-search-sort { margin:12px 0; } .sb-search-sort[aria-pressed="true"] { border-color:#ffb38f; }
 .sb-review { position:fixed; right:16px; bottom:90px; z-index:2147483647; display:flex; flex-direction:column; gap:10px; width:400px; max-width:calc(100vw - 32px); box-sizing:border-box; font-family:${BADGE_FONT},-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
 .sb-review { animation:sb-review-in .32s cubic-bezier(.2,.8,.2,1) both; }
 @keyframes sb-review-in { from { opacity:0; transform:translateY(10px) scale(.98); } }
 @keyframes sb-review-in-down { from { opacity:0; transform:translateY(-10px) scale(.98); } }
 .sb-review-left { right:auto; left:var(--sb-review-left,max(16px,3vw)); }
 .sb-review-top { bottom:auto; top:80px; flex-direction:column-reverse; animation-name:sb-review-in-down; }
 .sb-review *, .sb-review *::before, .sb-review *::after { box-sizing:border-box; }
 .sb-review svg { display:block; flex:none; }
 .sb-review button { font:inherit; color:inherit; cursor:pointer; }
 .sb-review a { color:inherit; text-decoration:none; }
 .sb-review-shell { display:grid; grid-template-rows:0fr auto; overflow:hidden; border:1px solid #3a3431; border-radius:30px; background:#1b1918; box-shadow:0 12px 30px #0008; transition:grid-template-rows .38s cubic-bezier(.3,.7,.1,1),border-radius .38s cubic-bezier(.3,.7,.1,1),border-color .15s,box-shadow .15s; }
 .sb-review-shell:hover, .sb-review-open .sb-review-shell { border-color:#ff7a45; box-shadow:0 0 0 3px #ff7a4540,0 16px 40px #0009; }
 .sb-review-open .sb-review-shell { grid-template-rows:1fr auto; border-radius:22px; }
 .sb-review-top .sb-review-shell { grid-template-rows:auto 0fr; }
 .sb-review-top.sb-review-open .sb-review-shell { grid-template-rows:auto 1fr; }
 .sb-review-top .sb-review-card { order:2; }
 .sb-review-pill { display:flex; align-items:center; gap:10px; height:60px; padding:0 10px; }
 .sb-review-toggle { display:flex; align-items:center; gap:12px; flex:1; min-width:0; height:100%; padding:0; border:0; background:none; text-align:left; }
 .sb-review-toggle > svg { width:38px; height:38px; }
 .sb-review-text { display:flex; flex-direction:column; min-width:0; flex:1; line-height:1.2; }
 .sb-review-text b { font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
 .sb-review-sub { font-size:13px; color:#a39b93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
 .sb-review-faces { display:flex; flex:none; transition:opacity .2s; }
 .sb-review-open .sb-review-faces { opacity:0; }
 .sb-review-face { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:28px; border-radius:50%; border:2px solid #1b1918; color:#1b1918; font-size:12px; font-weight:700; }
 .sb-review-faces .sb-review-face + .sb-review-face { margin-left:-9px; }
 .sb-review-score { flex:none; padding:3px 8px; border-radius:8px; color:#1b1918; font-size:15px; font-weight:800; }
 .sb-review-stars { color:#ff7a45; letter-spacing:1px; white-space:nowrap; }
 .sb-review-stars s { color:#4a423e; text-decoration:none; }
 .sb-review-sub .sb-review-stars { font-size:13px; }
 .sb-review-action { flex:none; padding:7px 12px; border:0; border-radius:16px; background:#ff7a45; color:#1b1918 !important; font-size:14px; font-weight:700; white-space:nowrap; }
 .sb-review-ghost { background:transparent; border:1px solid #3a3431; color:#fbf4ec !important; font-weight:500; }
 .sb-review-chevron { display:flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; padding:0; border:0; border-radius:50%; background:#2a2421; color:#a39b93; }
 .sb-review-chevron svg { width:16px; height:16px; transition:transform .38s cubic-bezier(.3,.7,.1,1); }
 .sb-review-open .sb-review-chevron svg, .sb-review-top .sb-review-chevron svg { transform:rotate(180deg); }
 .sb-review-top.sb-review-open .sb-review-chevron svg { transform:none; }
 .sb-review-shell:hover .sb-review-chevron, .sb-review-chevron:hover { background:#ff7a45; color:#1b1918; }
 .sb-review-card { min-height:0; overflow:hidden; }
 .sb-review-card-inner { padding:18px 18px 0; opacity:0; transform:translateY(8px); transition:opacity .2s ease,transform .2s ease; }
 .sb-review-card-inner::after { content:""; display:block; height:1px; margin-top:14px; background:#3a3431; }
 .sb-review-top .sb-review-card-inner { padding:0 18px 18px; transform:translateY(-8px); }
 .sb-review-top .sb-review-card-inner::after { display:none; }
 .sb-review-top .sb-review-card-inner::before { content:""; display:block; height:1px; margin-bottom:14px; background:#3a3431; }
 .sb-review-open .sb-review-card-inner { opacity:1; transform:none; transition-delay:.16s; transition-duration:.26s; }
 .sb-review-head { display:flex; align-items:center; gap:10px; font-weight:700; }
 .sb-review-head svg { width:24px; height:24px; }
 .sb-review-close { margin-left:auto; width:32px; height:32px; padding:0; border:0; border-radius:50%; background:none; color:#a39b93; font-size:20px; line-height:1; }
 .sb-review-close:hover { background:#2a2421; color:#fbf4ec; }
 .sb-review-heading { margin:10px 0 2px; font-size:22px; font-weight:800; line-height:1.15; letter-spacing:-.2px; overflow-wrap:anywhere; }
 .sb-review-section { margin-top:14px; padding-top:12px; border-top:1px solid #3a3431; }
 .sb-review-label { margin-bottom:8px; color:#a39b93; font-size:12px; letter-spacing:1.2px; text-transform:uppercase; }
 .sb-review-friend { display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:15px; }
 .sb-review-friend .sb-review-stars { margin-left:auto; font-size:14px; }
 .sb-review-average { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:12px; background:#2a2421; font-size:15px; }
 .sb-review-more { margin-left:auto; color:#a39b93 !important; font-size:13px; }
 .sb-review-note { margin:10px 0 0; color:#cfc6bc; font-size:14px; line-height:1.4; }
 .sb-review-buttons { display:flex; gap:10px; margin-top:14px; }
 .sb-review-primary, .sb-review-secondary { display:flex; flex:1; align-items:center; justify-content:center; min-height:44px; padding:10px 14px; border-radius:12px; font-size:15px; font-weight:700; text-align:center; }
 .sb-review-primary { border:0; background:#ff7a45; color:#1b1918 !important; }
 .sb-review-secondary { border:1px solid #3a3431; background:transparent; color:#fbf4ec !important; font-weight:500; }
 .sb-review-footnote { margin:12px 0 0; color:#a39b93; font-size:12px; text-align:center; }
 @media (prefers-reduced-motion:reduce) { .sb-review, .sb-review *, .sb-feature-button,.sb-episode-rating,.sb-card-rating,.sb-hide-title { animation:none !important; transition:none !important; } }
 `
	document.head.append(style)
}

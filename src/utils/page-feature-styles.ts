// Scoped to streamBuddy's injected controls; avoid styling the host site's UI.
export function installPageFeatureStyle() {
	if (document.getElementById("sb-page-features-style")) return
	const style = document.createElement("style")
	style.id = "sb-page-features-style"
	style.textContent = `
 .sb-detail-panel,.sb-rate-prompt { --sb-feature-bg:#111820f2; --sb-feature-text:#edf1f5; --sb-feature-muted:#bdc7d2; --sb-feature-line:#ffffff26; color:var(--sb-feature-text); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
 .sb-detail-panel { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; margin:16px 0; padding:12px 14px; border:1px solid var(--sb-feature-line); border-radius:10px; background:var(--sb-feature-bg); }
 .sb-detail-panel a { text-decoration:none; color:inherit; } .sb-detail-score { font-size:17px; font-weight:650; }
 .sb-detail-panel small { color:var(--sb-feature-muted); line-height:1.5; }
 .sb-feature-button { display:inline-flex; align-items:center; justify-content:center; min-height:40px; box-sizing:border-box; cursor:pointer; padding:8px 12px; background:#202934; color:#edf1f5; border:1px solid #ffffff30; border-radius:8px; font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
 .sb-feature-button:hover:not(:disabled) { background:#2d3947; } .sb-feature-button:disabled { cursor:default; opacity:.65; }
 .sb-hide-title:focus-visible,.sb-card-rating:focus-visible,.sb-detail-panel a:focus-visible,.sb-feature-button:focus-visible,.sb-episode-rating:focus-visible,.sb-rate-prompt a:focus-visible,.sb-rate-prompt button:focus-visible { outline:2px solid #b7c9df; outline-offset:3px; }
 .sb-episode-host { position:relative !important; } .sb-episode-rating { position:absolute; right:6px; bottom:6px; z-index:4; padding:5px 8px; border:1px solid #ffffff26; border-radius:6px; background:#10151df2; color:#fff; font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; text-decoration:none; }
 .sb-hide-title { position:absolute; top:4px; right:4px; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #ffffff30; border-radius:8px; background:#111820e8; color:#edf1f5; font:22px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; cursor:pointer; z-index:10; }
 .sb-hide-title:hover { background:#2d3947; }
 .sb-search-sort { margin:12px 0; } .sb-search-sort[aria-pressed="true"] { border-color:#b7c9df; }
 .sb-rate-prompt { position:fixed; right:16px; bottom:90px; z-index:2147483647; width:320px; max-width:calc(100vw - 32px); box-sizing:border-box; padding:16px; border-radius:12px; border:1px solid var(--sb-feature-line); background:var(--sb-feature-bg); box-shadow:0 8px 30px #0008; }
 .sb-rate-prompt-title { font-weight:600; margin-bottom:8px; overflow-wrap:anywhere; }
 .sb-rate-prompt a,.sb-rate-prompt button { display:inline-flex; align-items:center; min-height:40px; font:500 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
 .sb-rate-prompt a { color:#7be6a0; margin-right:16px; text-decoration:none; }
 .sb-rate-prompt button { border:0; background:transparent; color:var(--sb-feature-muted); cursor:pointer; padding:8px; }
 @media (prefers-reduced-motion:reduce) { .sb-detail-panel *, .sb-rate-prompt *, .sb-feature-button,.sb-episode-rating,.sb-card-rating,.sb-hide-title { animation:none !important; transition:none !important; } }
 `
	document.head.append(style)
}

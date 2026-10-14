# Firefox Add-ons (AMO) submission

Prepared 14 October 2026 for version 1.0.1, which includes the Buddy redesign. Not yet submitted. It is ready apart from the steps under "Before submitting".

- Item: streamBuddy 1.0.1
- Add-on ID: `streambuddy@jgreen417`. This is permanent: AMO keys the listing to it, so it must never change.
- Package: `release/firefox-1.0.1.zip`, built with `npm run build:release:firefox`.
- Source package: `release/streambuddy-source.zip`, built with `npm run build:source` from the same commit. AMO requires the source because Vite bundles the add-on.
- Manifest: version 2. The build converts the MV3 config, so host permissions are granted at install. Desktop Firefox 140 and later only.

## Verification (14 October 2026, 1.0.1)

- `web-ext lint`: 0 errors, 0 notices, 1 warning. The warning is Vue's own `innerHTML` assignment in `runtime-dom.esm-bundler.js`, which AMO accepts for unmodified framework code.
- Tests: 118 passed, 1 skipped. The `vue-tsc` typecheck and `eslint --max-warnings=0` are clean.
- The build is reproducible: two clean builds produced byte-identical files, which AMO reviewers check against the source package.
- The release build contains no development TMDb token or Letterboxd username (`RELEASE=1` blanks both).

## Playback adapter review (`src/playback/`)

Nothing in the adapters or the engine is Chrome-only. They use the `browser` global from webextension-polyfill, standard DOM and media APIs, and `storage.local` / `storage.sync`.

- `element.checkVisibility({ opacityProperty, visibilityProperty })` needs Firefox 122+; the 140 minimum covers it.
- Content scripts change `video.currentTime`, `playbackRate` and `muted` through Firefox's Xray wrappers, which allow those properties. This needs a live check on each site.
- Netflix ads fast-forward at 8×. Firefox mutes audio above 4× but still plays the video. The engine mutes during ads anyway, but Netflix's player may handle the rate differently in Firefox.
- The overlay (skip notices, speed pill) adds a `<style>` inside a shadow root. Netflix and Max send strict CSP headers, so check that the pills are styled and not plain text.
- `storage.sync` (settings, per-show rules) works in Firefox only because the add-on has a fixed ID. It syncs through the user's Mozilla account.
- The background script runs as a persistent MV2 background page; `persistent: false` from the config is dropped by the build. This is fine on Firefox and keeps the in-memory Letterboxd caches alive.

## Firefox testing (14 October 2026)

Tested live in Firefox 157 on macOS against Netflix, Prime Video and Max, with Widevine and signed-in accounts. Full results: `/mnt/project-files/firefox-submission/firefox-test-results.md`.

- Firefox-specific behaviour all passed: content-script chunk loading from `moz-extension://`, overlays under Netflix's and Max's CSP, `storage.sync`, DRM playback, the popup and the options page.
- Bugs found that aren't specific to Firefox were fixed in PR #6: the title panel on all three sites, the "Watch again" titles on Max, Netflix Undo (now hidden, because Netflix blocks seeks), pause after N episodes, and the Max credits notice. These fixes were checked live in Firefox.
- Not tested: Letterboxd sign-in and "Add to watchlist" (skipped at the owner's request), "Still watching?", recap skips, and real ad breaks (no ad-tier plans).

## AMO listing fields

Reuse `store/LISTING.md` (Buddy redesign copy) for the name, summary and description. For the screenshot, use `store/screenshots/netflix-ratings.png` (1280×800). AMO takes the icon from the manifest (`src/assets/Logo/icon.svg`). The promo tiles are Chrome-only. AMO-specific fields:

- Summary: the manifest description (132 characters, within AMO's 250).
- Categories: Photos, Music & Videos.
- License: GNU GPL v3.0.
- Privacy policy: paste `PRIVACY.md`, since AMO hosts the text rather than taking a link.
- Homepage: https://github.com/jgreen417/streambuddy. Support site: https://github.com/jgreen417/streambuddy/issues
- Data collection: the manifest declares `websiteContent` and `authenticationInfo` as required. AMO shows these on install, so they must match `PRIVACY.md`.

## Notes to reviewer (paste into "Notes to Reviewer")

> Build: Node 22, npm 10. Run `npm ci`, then `npm run build:release:firefox`. The output in `release/firefox/` matches the uploaded package byte for byte (`SOURCE_DATE_EPOCH` is fixed, and the code is not minified). Third-party code comes from npm (Vue, Pinia, vue-i18n, webextension-polyfill, webext-bridge).
>
> Ratings need a TMDb API read token, entered on the welcome page. Test token: [paste Josh's TMDb read token here, in AMO's confidential reviewer notes only. Never commit it.]
>
> Network use: TMDb (title matching), letterboxd.com (ratings and, when the user confirms, adding a film to their watchlist using their existing Letterboxd sign-in), and caching.graphql.imdb.com (IMDb ratings). No analytics and no remote code.

## Decisions (14 October 2026)

- Android: desktop only. When uploading, untick Firefox for Android under compatibility. Leave `gecko_android` in the manifest: AMO decides platforms at upload, and without that key `web-ext lint` warns that Android 140 predates `data_collection_permissions`.
- Distribution: listed publicly on AMO.
- Reviewer credential: Josh's own TMDb token goes in the confidential reviewer notes.
- Timing: submit after the Buddy redesign. Done: it shipped in 1.0.1.

## Before submitting

1. Merge PR #6, then rebuild both zips from `main` so that the package and source match the merged commit.
2. Sign in to addons.mozilla.org with Josh's Firefox account. This is a Mozilla account, separate from the Chrome publisher account.
3. Submit a new add-on: choose "On this site" (listed), upload `firefox-1.0.1.zip`, untick Android, upload `streambuddy-source.zip`, paste the reviewer notes with the token, then fill in the listing fields above.

# Firefox Add-ons (AMO) submission

Prepared 14 October 2026. Not yet submitted.

- Item: streamBuddy 1.0.0
- Add-on ID: `streambuddy@jgreen417` (permanent: AMO keys the listing to it, so it must never change)
- Package: `release/firefox-1.0.0.zip`, built with `npm run build:release:firefox`
- Source package: `release/streambuddy-source.zip`, built with `npm run build:source` (AMO requires source because the add-on is bundled by Vite)
- Manifest: version 2 (the build converts the MV3 config, so host permissions are granted at install), Firefox 140+ desktop, 142+ Android

## Verification (14 October 2026)

- `web-ext lint`: 0 errors, 0 notices, 1 warning. The warning is Vue's own `innerHTML` assignment in `runtime-dom.esm-bundler.js`, which AMO accepts for unmodified framework code.
- Tests: 109 passed, 1 skipped. `vue-tsc` typecheck clean.
- The build is reproducible: two clean builds produced byte-identical files, which AMO reviewers check against the source package.
- No development TMDb token or Letterboxd username in the release build (`RELEASE=1` blanks both).
- Fixed: `web_accessible_resources` listed each shared chunk three times (once per content script). It is now one de-duplicated list of 14 files.

## Playback adapter review (`src/playback/`)

Nothing in the adapters or the engine is Chrome-only. They use the `browser` global from webextension-polyfill, standard DOM and media APIs, and `storage.local` / `storage.sync`.

- `element.checkVisibility({ opacityProperty, visibilityProperty })` needs Firefox 122+; the 140 minimum covers it.
- Content scripts change `video.currentTime`, `playbackRate` and `muted` through Firefox's Xray wrappers, which allow those properties. This needs a live check on each site.
- Netflix ads fast-forward at 8×. Firefox mutes audio above 4× but still plays the video. The engine mutes during ads anyway, but Netflix's player may handle the rate differently in Firefox.
- The overlay (skip notices, speed pill) adds a `<style>` inside a shadow root. Netflix and Max send strict CSP headers, so check that the pills are styled and not plain text.
- `storage.sync` (settings, per-show rules) works in Firefox only because the add-on has a fixed ID. It syncs through the user's Mozilla account.
- The background script runs as a persistent MV2 background page; `persistent: false` from the config is dropped by the build. This is fine on Firefox and keeps the in-memory Letterboxd caches alive.

## Manual tests in Firefox (desktop, release build)

Load `release/firefox/manifest.json` from `about:debugging` > This Firefox > Load Temporary Add-on, or run `npm run firefox` against `dist/firefox`.

Install and settings

- [ ] Fresh install opens the welcome page; finishing setup saves the TMDb key and Letterboxd username.
- [ ] The toolbar popup and options page render at the right size, with no console errors.
- [ ] Settings changed in the options page take effect on an open streaming tab without a reload.

Ratings (each of Netflix, Prime Video, HBO Max)

- [ ] Rating badges appear on browse rows, search results and title pages. This also confirms the content-script loader can import its chunks from `moz-extension://`.
- [ ] The title panel shows friends' ratings when a Letterboxd username is set.
- [ ] IMDb per-episode ratings load on a series page.

Letterboxd account features (highest risk in Firefox)

- [ ] Signed in to letterboxd.com in Firefox, "Add to watchlist" succeeds and the film shows on the Letterboxd watchlist. Firefox handles cookies on extension requests differently from Chrome (Total Cookie Protection, SameSite), so this may fail even though it works in Chrome.
- [ ] Repeat with Enhanced Tracking Protection set to Strict.
- [ ] The rate-at-credits prompt appears near the end of a film.

Playback (each site)

- [ ] Skip intro, skip recap, and credits/next episode skip, each showing a notice with a working Undo.
- [ ] "Not for this show" stops skips for that show and the rule appears in options.
- [ ] Netflix "Are you still watching?" is dismissed.
- [ ] Speed pill on Prime Video and HBO Max; Shift + < / > on all three; speed is kept on the next episode.
- [ ] Notices and speed pill are visible and styled in fullscreen.
- [ ] Ads: Prime Video seeks past them; Netflix ad tier fast-forwards muted and restores sound and speed afterwards.
- [ ] Pause after N autoplayed episodes.
- [ ] Netflix games rows and Prime paid titles are hidden when those options are on.

Android (only if Android support stays in the manifest)

- [ ] Install from AMO on Firefox for Android; the popup, options and rating badges work on the mobile sites.

## AMO listing fields

Reuse `store/LISTING.md` for the name, summary, description and screenshots. AMO-specific fields:

- Summary: the manifest description (126 characters, within AMO's 250).
- Categories: Photos, Music & Videos (desktop); Entertainment on Android if kept.
- License: GNU GPL v3.0.
- Privacy policy: paste `PRIVACY.md`, since AMO hosts the text rather than taking a link.
- Homepage: https://github.com/jgreen417/streambuddy. Support site: https://github.com/jgreen417/streambuddy/issues
- Data collection: the manifest declares `websiteContent` and `authenticationInfo` as required. AMO shows these on install, so they must match `PRIVACY.md`.

## Notes to reviewer (paste into "Notes to Reviewer")

> Build: Node 22, npm 10. Run `npm ci`, then `npm run build:release:firefox`. The output in `release/firefox/` matches the uploaded package byte for byte (`SOURCE_DATE_EPOCH` is fixed, and the code is not minified). Third-party code comes from npm (Vue, Pinia, vue-i18n, webextension-polyfill, webext-bridge).
>
> Ratings need a TMDb API read token, entered on the welcome page. [Test credential to be added here only if the owner approves sharing it with Mozilla's reviewers.]
>
> Network use: TMDb (title matching), letterboxd.com (ratings and, when the user confirms, adding a film to their watchlist using their existing Letterboxd sign-in), and caching.graphql.imdb.com (IMDb ratings). No analytics and no remote code.

## Decisions before submitting

- Android: keep `gecko_android` (AMO lists it for Firefox for Android, untested so far) or remove it and ship desktop only.
- Reviewer credential: share the development TMDb token with Mozilla's reviewers, as was done for Google.
- Distribution: listed on AMO (public) or self-distributed (signed file only).

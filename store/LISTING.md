# Chrome Web Store listing

Paste these into the Developer Dashboard. Character limits are noted where the store enforces them.

## Store listing tab

**Name** (from the manifest): streamBuddy

**Summary** (132 max, currently 131):
> Your friends' Letterboxd ratings plus Letterboxd and IMDb scores on Netflix, Prime Video, HBO Max, Disney+ and Crunchyroll posters.

**Category:** Entertainment

**Language:** English (Australia), or English

**Description:**

> Watch what your friends loved. streamBuddy puts your Letterboxd friends' ratings, and your own, right on the posters on Netflix, Prime Video, HBO Max, Disney+ and Crunchyroll.
>
> Every supported title card gets a small colour-coded chip: the Letterboxd average for films and the IMDb rating for series, where a matching rating is available. Connect your Letterboxd and the same chip shows how your friends rated it and whether you've seen it or saved it for later.
>
> YOUR FRIENDS, ON THE POSTER (connect Letterboxd, optional)
> • Friends' average rating on matched films, and who rated them
> • Your own stars on films you've logged, with watchlisted films marked
> • A review pill as the credits roll: your friends' ratings and a one-click Rate on Letterboxd
>
> FIND THE GOOD STUFF FASTER
> • IMDb ratings for every episode of a season
> • An optional cut-off that hides low-rated titles
> • Ratings and sort-by-rating on search pages
> • Watched films can fade back so new ones stand out
> • Pick your scores: Letterboxd, IMDb, TMDb, or Letterboxd for films and IMDb for series
> • Two badge looks: the classic cream chip, or Liquid Glass from clear to frosted
>
> WATCH WITHOUT THE FIDDLY BITS
> • Optional automatic skipping of supported intro, recap and credits controls, with a notice and one-tap Undo
> • Optional handling of "Still watching?" prompts; available controls vary by service and title
> • "Don't skip for this show" keeps a theme song you love; optionally hear episode 1's intro
> • Speed that sticks: remembered per service and kept on the next episode, with Shift + < / > shortcuts and a speed pill on Prime Video, HBO Max, Disney+ and Crunchyroll
> • Optional pause after a few episodes autoplay in a row
> • Hides Netflix's mobile-games rows, and optionally Prime titles that cost extra
>
> STATS
> • Weekly watch time by service, plus watchlist films that are streaming now
>
> SETUP TAKES TWO MINUTES
> Ratings work straight after install. Add your Letterboxd username (optional) to see friends' ratings, and your own free TMDb key if you like. Both stay in your browser.
>
> PRIVATE BY DESIGN
> No streamBuddy account, no developer server and no analytics. Ratings requests go directly to TMDb, Letterboxd and IMDb. Settings, your optional Letterboxd username and optional TMDb key use your browser's sync storage; watch-time stats stay on your device.
>
> streamBuddy is free and open source (GPL-3.0). It started from the Streaming enhanced extension by Dreamlinerm. If it helps you pick better films, you can support it at ko-fi.com/joshgreen48454. It is an independent project, not affiliated with or endorsed by Letterboxd, IMDb, Netflix, Amazon or Warner Bros. Discovery. This product uses the TMDb API but is not endorsed or certified by TMDb.

**Graphics:**

| Asset | Size | Status |
|---|---|---|
| Store icon | 128×128 PNG | Ready: `src/assets/Logo/icon-128.png` (96×96 mark with 16px transparent padding, as the store asks) |
| Screenshots | 1280×800 PNG | Ready: the four files below, in this order |
| Small promo tile | 440×280 PNG | Ready: `store/promo-small.png` (source: `promo-small.svg`, set in Bricolage Grotesque) |
| Marquee promo tile (optional) | 1400×560 PNG | Ready: `store/promo-marquee.png` (source: `promo-marquee.svg`) |

**Screenshots** (1280×800, upload in this order, replacing the 1.0.0 one):
1. `store/screenshots/netflix-ratings.png`: live Netflix home rows with the Buddy badge
2. `store/screenshots/review-pill.png`: the review card over Netflix's end credits (the shipped pill, opened, rendered by the visual-check harness at 1280×800 with fuller credits and player controls drawn in)
3. `store/screenshots/badge-looks.png`: Classic and Liquid Glass badges side by side
4. `store/screenshots/popup-settings.png`: the toolbar popup with the main switches

**Links:**
- Homepage: https://github.com/jgreen417/streambuddy
- Support: https://github.com/jgreen417/streambuddy/issues

## Privacy practices tab

**Single purpose:**
> Show film and TV ratings from Letterboxd and IMDb on streaming sites, with playback conveniences (skip intro and speed) for those same sites.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's settings, Letterboxd username and TMDb key, and a local cache of ratings so titles aren't looked up repeatedly. |
| `activeTab` | Lets the toolbar popup see which streaming service the current tab is on, so it can show that service's settings. |
| Host: `letterboxd.com` | Fetches public film pages for ratings and, if the user enters a username, their public diary, watchlist and friends' ratings. |
| Host: `caching.graphql.imdb.com` | Fetches IMDb ratings for series and episodes. |
| Content scripts on Netflix, Prime Video/Amazon, HBO Max, Disney+ and Crunchyroll | Reads title names to place rating badges, and finds the player's skip buttons and ad timer to skip intros, credits and ads. Prime Video is hosted on Amazon's domains, so those are included. On HBO Max, Prime Video and Disney+ a small page script reads the service's own playback responses for the end-credits time, so the review pill appears as the credits start; it only reads those responses, changes nothing and sends nothing anywhere. On Crunchyroll it reads Crunchyroll's public skip-times file for the episode playing, the same one Crunchyroll's player loads. |

**Remote code:** No. All code is in the package. Nothing is fetched and run with eval.

**Data usage** (tick these boxes):
- **Personally identifiable information:** yes. The optional Letterboxd username is stored in browser sync storage and used to request that public profile from Letterboxd.
- **Website content:** yes. Title names on streaming pages are sent to TMDb, Letterboxd and IMDb to look up ratings.
- **Authentication information:** yes. streamBuddy's built-in TMDb key, or the user's own if they add one, is sent only to api.themoviedb.org.
- **Web history:** yes. The extension keeps a local record of recently displayed streaming titles and their URLs for its Stats tab, and reads the current streaming tab to select service settings. It does not read general browser history.
- **User activity:** yes. Watch time by day and service is recorded locally for the Stats tab. It is never sent to the developer.
- Everything else (health, financial, location, communications): no.

Local processing and browser sync storage still count as data handling for Chrome Web Store disclosure. See https://developer.chrome.com/docs/webstore/program-policies/user-data-faq.

Then tick all three certifications: data isn't sold, isn't used for unrelated purposes, and isn't used for creditworthiness.

**Privacy policy URL:** https://github.com/jgreen417/streambuddy/blob/main/PRIVACY.md

## Distribution tab

- **Visibility:** Public, or Unlisted for a soft launch
- **Pricing:** Free
- **Regions:** All

## Reviewer notes (test instructions field)

> To see ratings, the extension needs a free TMDb API key, which the welcome page explains how to get. A Letterboxd username is optional. A test key can be supplied on request. Ratings appear on title cards on netflix.com, primevideo.com, play.hbomax.com, disneyplus.com and crunchyroll.com once signed in to those services.

---

# Firefox Add-ons (addons.mozilla.org) listing

Submit at https://addons.mozilla.org/developers/addon/submit/ and choose "On this site".

**Files to upload:**
1. **Add-on:** `release/firefox-1.0.0.zip`. Build it with `npm run build:release:firefox`.
2. **Source code:** when asked "Do you need to submit source code?", answer **Yes**, because the add-on is bundled by Vite. Upload `release/streambuddy-source.zip`, made with `npm run build:source` from a clean, committed checkout.

**Compatibility:** Firefox (desktop) and Firefox for Android.

**Name:** streamBuddy

**Add-on URL:** `streambuddy`

**Summary** (250 max):
> Your friends' Letterboxd ratings plus Letterboxd and IMDb scores on Netflix, Prime Video, HBO Max, Disney+ and Crunchyroll posters. Seen and watchlist marks, episode ratings and intro skipping. Free, open source, no tracking.

**Description:** reuse the Chrome description above. AMO supports basic Markdown, so the capitals headings can become `**bold**`.

**Categories** (up to 2): Photos, Music & Videos · Search Tools

**Tags:** letterboxd, imdb, netflix, ratings, movies

**Support email:** your own (a separate address is fine). **Support site:** https://github.com/jgreen417/streambuddy/issues

**Licence:** GNU General Public License v3.0

**Privacy policy:** AMO asks for the policy text itself, not a link. Paste the contents of `PRIVACY.md`.

**Notes to reviewer:**
> streamBuddy is built from the uploaded source with Vite. To reproduce the package:
>
> 1. Node.js 24 and npm 11 (built with Node 24.21.0, npm 11.19.0).
> 2. `npm ci`
> 3. `npm run build:release:firefox`
> 4. The unpacked add-on is in `release/firefox/` and the zip is `release/firefox-1.0.0.zip`.
>
> Release builds embed streamBuddy's shared TMDb key from the `STREAMBUDDY_TMDB_KEY` environment variable (given in these notes); `.env` is not used. Ratings work without setup. A Letterboxd username is optional (any public profile works). Ratings appear on title cards on netflix.com, primevideo.com, play.hbomax.com, disneyplus.com and crunchyroll.com once signed in.
>
> Permissions: storage and activeTab, plus host access to letterboxd.com and caching.graphql.imdb.com for ratings, and content scripts on Netflix, Prime Video, HBO Max, Disney+ and Crunchyroll. On HBO Max, Prime Video and Disney+ a page script reads only the service's own playback responses, for the end-credits time; on Crunchyroll the content script reads Crunchyroll's public skip-times file. Data collection: website content (title names sent to TMDb, Letterboxd and IMDb to look up ratings) and authentication info (the built-in or user's own TMDb key and the Letterboxd username, sent only to those services). Nothing goes to the developer.
>
> The single linter warning (innerHTML) is in Vue's runtime (`runtime-dom.esm-bundler.js`), not in streamBuddy's code.

**Before submitting, test in Firefox:** load `release/firefox/manifest.json` via `about:debugging` → This Firefox → Load Temporary Add-on. Then check badges on Netflix, Prime Video, HBO Max, Disney+ and Crunchyroll, the welcome page, and the popup.

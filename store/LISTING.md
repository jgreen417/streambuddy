# Chrome Web Store listing: streamBuddy 1.0.0

Paste these into the Developer Dashboard. Character limits are noted where the store enforces them.

## Store listing tab

**Name** (from the manifest): streamBuddy

**Summary** (132 max, currently 126):
> Letterboxd and IMDb ratings on Netflix, Prime Video and HBO Max, with friends' scores, your watchlist and skip-intro controls.

**Category:** Entertainment

**Language:** English (Australia), or English

**Description:**

> See what's actually worth watching without leaving Netflix, Prime Video or HBO Max.
>
> streamBuddy adds a small, colour-coded score to every title: the Letterboxd average for films and the IMDb rating for series. Colours are tuned to how each site's ratings are spread, so green really means great.
>
> CONNECT YOUR LETTERBOXD (optional)
> • Friends' ratings on every film, and who rated it
> • Your own stars on films you've logged, with watchlisted films marked
> • Add to your Letterboxd watchlist from a title page
> • A reminder to rate a film as the credits roll
>
> FIND THE GOOD STUFF FASTER
> • A rating panel on title pages, with friends' stars
> • IMDb ratings for every episode of a season
> • Best-in-row highlights, and an optional cut-off that hides low-rated titles
> • Ratings and sort-by-rating on search pages
> • Watched films can fade back so new ones stand out
>
> PLAYBACK
> • Skip intros, recaps, credits and ads, and adjust playback speed
>
> STATS
> • Weekly watch time by service, plus watchlist films that are streaming now
>
> SETUP TAKES TWO MINUTES
> Enter your Letterboxd username (optional) and a free TMDb key. A built-in guide shows how to get one. Both stay in your browser.
>
> PRIVATE BY DESIGN
> No account, no server, no tracking. streamBuddy talks directly to TMDb, Letterboxd and IMDb from your browser and never sends your data anywhere else.
>
> streamBuddy is free and open source (GPL-3.0), built on the Streaming enhanced extension. If it helps you pick better films, you can support it at ko-fi.com/joshgreen48454. It is an independent project, not affiliated with or endorsed by Letterboxd, IMDb, Netflix, Amazon or Warner Bros. Discovery. This product uses the TMDb API but is not endorsed or certified by TMDb.

**Graphics:**

| Asset | Size | Status |
|---|---|---|
| Store icon | 128×128 PNG | Ready: `src/assets/Logo/NetflixAmazon Auto-Skip--128.png` |
| Screenshots (1–5) | 1280×800 PNG | Shot list below; capture on real pages |
| Small promo tile | 440×280 PNG | Ready: `store/promo-small.png` |
| Marquee promo tile (optional) | 1400×560 PNG | Ready: `store/promo-marquee.png` |

**Screenshot list** (1280×800, in this order):
1. Netflix home rows with badges, including a friends line, a "✓ you" mark and a best-in-row ring
2. A Netflix title pop-up with the rating panel and the "＋ Watchlist" button
3. An HBO Max or Prime Video series page with episode rating chips
4. The popup, Settings tab, next to a streaming page
5. The welcome page (two-step setup)

Tip: in Dia, set the window to 1280×800, or capture larger and scale down. Avoid showing other people's full names from friends' tooltips.

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
| Host: `letterboxd.com` | Fetches public film pages for ratings and, if the user enters a username, their public diary, watchlist and friends' ratings. Adds to the watchlist only when the user clicks and confirms. |
| Host: `caching.graphql.imdb.com` | Fetches IMDb ratings for series and episodes. |
| Content scripts on Netflix, Prime Video/Amazon, HBO Max, Disney+, Paramount+ and Crunchyroll | Reads title names to place rating badges, and finds the player's skip buttons and ad markers to skip intros and ads. Prime Video is hosted on Amazon's domains, so those are included. |

**Remote code:** No. All code is in the package. Nothing is fetched and run with eval.

**Data usage** (tick these boxes):
- **Website content:** yes. Title names on streaming pages are sent to TMDb, Letterboxd and IMDb to look up ratings.
- **Authentication information:** yes. The user's own TMDb key is stored and sent only to api.themoviedb.org.
- Everything else (personal info, health, financial, location, communications, web history, user activity): no. Watch-time stats stay on the device and are never transmitted.

Then tick all three certifications: data isn't sold, isn't used for unrelated purposes, and isn't used for creditworthiness.

**Privacy policy URL:** https://github.com/jgreen417/streambuddy/blob/main/PRIVACY.md

## Distribution tab

- **Visibility:** Public, or Unlisted for a soft launch
- **Pricing:** Free
- **Regions:** All

## Reviewer notes (test instructions field)

> To see ratings, the extension needs a free TMDb API key, which the welcome page explains how to get. A Letterboxd username is optional. A test key can be supplied on request. Ratings appear on title cards on netflix.com, primevideo.com and play.hbomax.com once signed in to those services.

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
> Letterboxd and IMDb ratings on Netflix, Prime Video and HBO Max, with your Letterboxd friends' scores, seen and watchlist marks, episode ratings, and skip-intro controls. Free, open source, no tracking.

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
> No API keys are needed to build; `.env` is not used for release builds. To see ratings while testing, enter a free TMDb key on the welcome page that opens on install. A Letterboxd username is optional (any public profile works). Ratings appear on title cards on netflix.com, primevideo.com and play.hbomax.com once signed in.
>
> Permissions: `webRequest`/`webRequestBlocking` change the user agent on Firefox for Android only, so streaming sites serve their desktop player. This is inherited from Streaming enhanced, which streamBuddy is built on. Data collection: website content (title names sent to TMDb, Letterboxd and IMDb to look up ratings) and authentication info (the user's own TMDb key and Letterboxd username, sent only to those services). Nothing goes to the developer.
>
> The single linter warning (innerHTML) is in Vue's runtime (`runtime-dom.esm-bundler.js`), not in streamBuddy's code.

**Before submitting, test in Firefox:** load `release/firefox/manifest.json` via `about:debugging` → This Firefox → Load Temporary Add-on. Then check badges on Netflix, Prime Video and HBO Max, the welcome page, and the popup.

# Saved site pages

Real Netflix, Prime Video and Max pages, saved once from a signed-in browser and served locally as if they were the
sites, so new UI can be built against them without opening the live sites.

| File | What it does |
|---|---|
| `probe.ts` | Runs streamBuddy's own site code (the adapters, the episode reader) on a page and reports what it finds |
| `capture.ts` | Saves a live page state: the frozen page, its fonts, the data feeds streamBuddy reads, a screenshot, the probe's report |
| `steps.ts` | Puts a loaded page into a saved state again: the seek, click or hover the capture took |
| `record.ts` | Records every response a page loads (`capture.ts --record`) and answers them again, so a copy can run the site's own code |
| `replay.ts` | Serves a saved state as the live site, with same-size stand-ins for artwork and video |
| `check.ts` | Checks every copy against the live page it came from, or, with `--live`, the live site against the copies |
| `report.ts` | Runs the probe on every saved state; `--coverage` lists the site code no saved page reaches |
| `open-browser.sh` | Opens the browser the capture attaches to |
| `publish.sh` | Copies saved pages (never recordings or storage) into streambuddy-sites and pushes them |

## Capturing (on the Mac)

1. Open the capture browser: `e2e/sites/open-browser.sh` (Google Chrome) or `e2e/sites/open-browser.sh dia`. Each has
   its own profile, kept between runs. The first time, sign in to Netflix, Prime Video and Max in it and pick a
   profile on each.
2. Save a state, one command each:

   ```sh
   npm run sites:capture -- --cdp http://127.0.0.1:9333 --out ~/streambuddy-firefox-test/captures \
     --state netflix-browse --service Netflix --url https://www.netflix.com/browse --scrub "Josh"
   ```

   `--hover` and `--click` take a selector to act on before saving (`>> nth=3` picks the fourth match); `--click`
   can be given more than once, such as a season menu and then the season. `--fill <selector> --text <text>` types
   into a field first, such as a search box. `--scroll <px>` wheels the page down first, `--seek-from-end <seconds>`
   puts a player that many seconds before the end (through Netflix's own player, which stops if its video is seeked
   directly, and through the player's timeline where the video has no length, as on Disney+), `--wait` is how long to let the page
   settle afterwards, and `--front` brings the tab forward (Dia holds a background tab's video at 0:00, so player
   states need it). `--scrub` replaces whole names, such as the profile names the site shows, with "Viewer" in every
   saved file, the probe's report included. Give each service its own list: a name that is also in a title is
   replaced there too.

   `--record` also saves every response the page loaded, its scripts included, for the interactive copy below. A
   recording holds whatever the site sent the account, session tokens included, so it stays on the Mac.
3. Check the copies against the pages they came from: `npm run sites:check -- ~/streambuddy-firefox-test/captures`.

The browser runs without extensions: a page streamBuddy has drawn into (badges, cards it has marked as picked up)
isn't the site, so the capture refuses it. The playback itself can't be saved (DRM), so a copy plays a silent clip of
the same length from the same place.

## When a site changes

`npm run sites:check -- <captures> --live http://127.0.0.1:9333` opens each saved state's URL on the live site and
compares what streamBuddy's site code finds there with what it found in the copy. It compares kinds of cards,
where their badges go and which player controls show, not titles or counts, so a broken selector shows up by name.
Save the state again once the adapter is fixed.

## Building against a saved page

`npm run sites:workbench -- <saved state>` opens the frozen copy with the built extension on it, rebuilding as `src/`
changes. A frozen copy is one moment of the page with the site's scripts removed: the site's hover cards and
transitions don't run in it. `--interactive` opens a state saved with `--record` instead: the site's own code runs from
the recording, so hovering any tile, opening menus and the site's transitions work, without the live site.

## In CI

The saved pages (without recordings or storage) live in the private `jgreen417/streambuddy-sites` repo:
`captures/<state>/` and, beside it, `baselines/` with each page's approved screenshot and badge count. The visual
checks workflow checks it out into `e2e/.sites-fixtures` with the `STREAMBUDDY_SITES_TOKEN` secret, and
`e2e/visual/captured.visual.ts` opens each page with the built extension: every badge fitted to artwork must sit to
the placement spec, and the count and screenshot must match the approved ones. Without the token those checks are
skipped. Locally: `SITES_DIR=<captures> npx playwright test --project "saved pages"`.

## Adding a service

Everything below runs against saved pages, so the live site is only needed for step 1 and the last check.

1. **Save its pages** on the Mac, one `sites:capture` per state, with the service's own name as `--service` (any name
   streamBuddy doesn't know yet saves the page without running site code on it) and `--record` on each. The states
   that matter are the ones streamBuddy draws on: home with every kind of card (scroll down until each row type has
   shown), a hovered card, search results, a film and a series title page with its episode list, and the player at
   the start, with controls up, at the credits and at the end screen. `npm run sites:check` must pass on all of them.
2. **Read the pages**, not the live site: `npm run sites:workbench -- <state> --interactive` gives the site's own page,
   with devtools, as often as needed. Note for each card kind its title, its artwork's box, and what marks a series.
3. **Write the two adapters**, starting from the closest existing pair:
   - `src/content-script/sites/<service>.ts`, a `RatingsSite` (`types.ts` says what each part answers), and
   - `src/playback/sites/<service>.ts`, a `SiteAdapter` for the player (video, skip buttons, episode, show title).

   Then register it: an entry in `SERVICES` (`src/constants/streamingServices.ts`, which also feeds both manifests;
   take it out of `OTHER_SERVICES`), an entry script in `src/content-script/` like `max.ts`, its playback defaults in
   `src/stores/storeTypes.ts`, its colour in `serviceColors` (`src/design/tokens.ts`), the title page and episode
   readers in `src/utils/page-features.ts` if it has them, its tab-title suffix in `src/utils/credits-review.ts`, and
   the adapters in `e2e/sites/probe.ts`'s `SITES`. If streamBuddy reads any of the site's own data responses, add
   them to `FEEDS` in `replay.ts` and save the pages again so the copies carry them.
4. **Check against the copies**: save the states again (now with the probe), then `npm run sites:report -- --coverage`
   shows what the adapters found on each page and which of their lines no page reaches; `sites:workbench` shows the
   badges as a viewer would. Badges must sit to the placement spec there (`captured.visual.ts` checks the same).
5. **Name it everywhere viewers read**: the copy that lists the services (`SUPPORTED_SERVICE_NAMES`, and the
   sentences in the popup's Experience settings, the Guide, Playback and install pages that name them by hand).
6. **Into CI**: `e2e/sites/publish.sh <captures> <streambuddy-sites clone> "<names>"` copies the new states (never
   a recording, `storage.json` or the unscrubbed `live.json`) and pushes them, after checking no listed name is left in them (`--none` when
   there are none). Then add the `accept-visuals` label to a pull request to write their first screenshots;
   saved pages' screenshots are never uploaded from CI, as the repo's run output is public.
7. **Last, the live site**: `npm run sites:check -- <captures> --live http://127.0.0.1:9333` once, then load the build
   in a browser and watch one film through its credits.

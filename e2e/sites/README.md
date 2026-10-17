# Saved site pages

Real Netflix, Prime Video and Max pages, saved once from a signed-in browser and served locally as if they were the
sites, so new UI can be built against them without opening the live sites.

| File | What it does |
|---|---|
| `probe.ts` | Runs streamBuddy's own site code (the adapters, the episode reader) on a page and reports what it finds |
| `capture.ts` | Saves a live page state: the frozen page, its fonts, the data feeds streamBuddy reads, a screenshot, the probe's report |
| `replay.ts` | Serves a saved state as the live site, with same-size stand-ins for artwork and video |
| `check.ts` | Checks every copy against the live page it came from, or, with `--live`, the live site against the copies |
| `report.ts` | Runs the probe on every saved state; `--coverage` lists the site code no saved page reaches |
| `open-browser.sh` | Opens the browser the capture attaches to |

## Capturing (on the Mac)

1. Open the capture browser: `e2e/sites/open-browser.sh` (Google Chrome) or `e2e/sites/open-browser.sh dia`. Each has
   its own profile, kept between runs. The first time, sign in to Netflix, Prime Video and Max in it and pick a
   profile on each.
2. Save a state, one command each:

   ```sh
   npm run sites:capture -- --cdp http://127.0.0.1:9333 --out ~/streambuddy-firefox-test/captures \
     --state netflix-browse --service Netflix --url https://www.netflix.com/browse --scrub "Josh"
   ```

   `--hover` and `--click` take a selector to act on before saving, `--seek-from-end <seconds>` puts a player that
   many seconds before the end (through Netflix's own player, which stops if its video is seeked directly), and
   `--wait` is how long to let the page settle afterwards. `--scrub` replaces words such as profile names.
3. Check the copies against the pages they came from: `npm run sites:check -- ~/streambuddy-firefox-test/captures`.

The browser runs without extensions: a page streamBuddy has drawn into (badges, cards it has marked as picked up)
isn't the site, so the capture refuses it. The playback itself can't be saved (DRM), so a copy plays a silent clip of
the same length from the same place.

## When a site changes

`npm run sites:check -- <captures> --live http://127.0.0.1:9333` opens each saved state's URL on the live site and
compares what streamBuddy's site code finds there with what it found in the copy. It compares kinds of cards,
where their badges go and which player controls show, not titles or counts, so a broken selector shows up by name.
Save the state again once the adapter is fixed.

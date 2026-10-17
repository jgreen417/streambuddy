# Visual checks

Checks the rating badges, the credits prompt, the episode chips, the toolbar popup and the settings pages without
opening a streaming site or a real browser. CI runs them on every pull request (`.github/workflows/visual.yml`).

## What a run does

1. Builds the Chrome extension as a store build (`global-setup.ts`).
2. Loads it into headless Chromium and opens saved copies of the sites (`fixtures/`): Netflix's standard, Top 10,
   Continue Watching, episode and narrow cards; Prime's carousel cards (with and without the prime or a channel logo),
   large cards, super carousel (also hovered, when Prime redraws the card around the badge), Top 10 and hero; Max's
   posters and landscape tiles; Netflix's player at the credits; and a Netflix series page with its episode list. The
   popup and settings pages (`pages.visual.ts`) open from the extension itself, at a fixed date so the Stats tab draws
   the same every run. Every request is answered by `harness.ts`, with ratings seeded from `ratings.ts`, so nothing
   touches the network or needs an account.
3. Measures every badge against the placement spec (`geometry.ts`): 3px from the artwork's right edge and from its top
   (Netflix) or bottom (Prime, Max), 3px above Prime's channel logo, inside the artwork, and corners concentric with
   the artwork's.
4. Screenshots each section and compares it with `baselines/`.

## When a check fails

The run's summary lists what changed. The **visual-report** artifact has the HTML report: open `index.html` to see
each screenshot as expected, actual and diff. Placement failures name the card and the gap, for example
`Past Lives: 5px from the top, want 3px`.

If the new look is intended, add the **accept-visuals** label to the pull request: CI re-renders, commits the new
screenshots to `baselines/` and removes the label (placement checks still have to pass). It then starts the
pull request's checks again on that commit. The same screenshots are also in the
**visual-new-baselines** artifact. CI renders in Playwright's own Linux image, so baselines come from CI rather than
from a local run.

## Running locally

```sh
npm run test:visual            # build, measure, compare
npm run test:visual:update     # write new baselines (fonts differ by machine: keep CI's)
npx playwright show-report e2e/.report
```

## Adding a case

- A new card layout: add its markup to the site's fixture, mark the artwork with `data-sb-art` and
  `data-sb-corner="top|bottom"`, give the title a rating in `ratings.ts`, and bump the site's badge count in
  `sites.ts`. Prime's cards must stay on one line with no whitespace inside them, as Prime serves them.
- A new setting: add an entry to `LOOKS` in `cards.visual.ts`.
- A new settings page: add its route to `pages.visual.ts`.
- A new overlay (the after-credits pill): add a test in `credits.visual.ts` on the player fixture; its states are
  already listed there as pending tests.

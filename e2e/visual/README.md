# Visual checks

Checks the rating badges and the credits prompt without opening a streaming site or a real browser. CI runs them on
every pull request (`.github/workflows/visual.yml`).

## What a run does

1. Builds the Chrome extension as a store build (`global-setup.ts`).
2. Loads it into headless Chromium and opens saved copies of the sites (`fixtures/`): Netflix's standard, Top 10,
   Continue Watching, episode and narrow cards; Prime's carousel cards (with and without the prime or a channel logo),
   large cards, super carousel, Top 10 and hero; Max's posters and landscape tiles; and Netflix's player at the
   credits. Every request is answered by `harness.ts`, with ratings seeded from `ratings.ts`, so nothing touches the
   network or needs an account.
3. Measures every badge against the placement spec (`geometry.ts`): 3px from the artwork's right edge and from its top
   (Netflix) or bottom (Prime, Max), 3px above Prime's channel logo, inside the artwork, and corners concentric with
   the artwork's.
4. Screenshots each section and compares it with `baselines/`.

## When a check fails

The run's summary lists what changed. The **visual-report** artifact has the HTML report: open `index.html` to see
each screenshot as expected, actual and diff. Placement failures name the card and the gap, for example
`Past Lives: 5px from the top, want 3px`.

If the new look is intended, the **visual-new-baselines** artifact holds the new screenshots: copy them into
`baselines/` and commit. CI renders in Playwright's own Linux image, so baselines come from CI rather than from a
local run.

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
- A new overlay (the after-credits pill): add a test in `credits.visual.ts` on the player fixture; its states are
  already listed there as pending tests.

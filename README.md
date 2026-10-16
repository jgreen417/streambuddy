<div align="center">
<img src="src/assets/logo.png" height="72">

# streamBuddy

**Letterboxd and IMDb ratings, right on Netflix, Prime Video and HBO Max.**

</div>

streamBuddy puts a small score on every title card. Films show their Letterboxd average and series show their IMDb rating, coloured on a scale tuned to how each site's ratings are actually spread. Connect your Letterboxd profile to add friends' ratings, marks for films you've seen or watchlisted, and a nudge to rate a film as the credits roll.

## Features

- **Ratings on every card.** Letterboxd for films and IMDb for series, on home rows and search results.
- **Friends' ratings.** Your Letterboxd friends' average, and who rated it, on each film.
- **Your diary.** Films you've logged show your stars, and watchlisted films are marked. Watched films can fade back.
- **Episode ratings.** IMDb ratings for every episode of the season you're viewing.
- **Find the good stuff.** An optional cut-off that hides low-rated titles, and sort-by-rating on search pages.
- **Stats.** Weekly watch time by service, plus watchlist films that are streaming now.
- **Skips you can trust.** Intros, recaps, credits, ads and "Still watching?" are handled for you, each with a small notice and one-tap Undo.
- **Your rules.** Choose "Not for this show" to keep a theme song you love, or let the first episode of a season play its intro.
- **Speed that sticks.** Remembered per service and kept through ads and new episodes, with Shift + < and > shortcuts. Prime Video and HBO Max, which have no speed menu, get a speed pill.
- **Autoplay limit.** Optionally pause after a few episodes play in a row without you touching anything.
- **Cleaner pages.** Hide Netflix's mobile-games rows and, optionally, Prime Video titles you'd have to pay extra for.

## Setup

1. Install streamBuddy. A welcome page opens.
2. Enter your Letterboxd username. This is optional, but it enables friends, your diary and your watchlist.
3. Optionally paste your own free TMDb key. Store builds come with a shared key, so this is only needed if ratings pause; the [in-extension guide](src/ui/options-page/pages/Guide.vue) shows how.

Both values stay in your browser. See [PRIVACY.md](PRIVACY.md).

## Building

Requires Node.js 24 and npm 11.

```bash
npm install
npm run build:chrome   # dist/chrome: your own unpacked copy; reads TMDB_TOKEN and LETTERBOXD_USERNAME from .env
npm run build:release          # release/chrome and the Chrome Web Store zip, no personal keys baked in
npm run build:release:firefox  # release/firefox and the Firefox Add-ons zip
npm run build:source           # release/streambuddy-source.zip, the source upload Firefox reviewers ask for
npm test
```

## Development

```bash
npm run dev:chrome   # rebuilds dist/chrome on every change; load it unpacked from chrome://extensions
npm run dev:firefox  # same for dist/firefox
npm run lint
npm run typecheck
npm run test:coverage
```

Content scripts live in `src/content-script` (one per service, with shared logic in `shared-functions.ts`), skip and speed handling in `src/playback`, and the popup and options pages in `src/ui`. Settings are a Pinia store in `src/stores/options.store.ts`, and translations are in `src/locales`.

Colours, type, shadows and motion come from the design tokens in `src/design/tokens.ts`; see [docs/design-system.md](docs/design-system.md).


## Support

streamBuddy is free. If it saves you from a bad film night, you can [buy me a coffee on Ko-fi](https://ko-fi.com/joshgreen48454).

## Credits and licence

streamBuddy started from [Streaming enhanced](https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip) by Marvin Krebber (Dreamlinerm), and like it is licensed under the [GNU GPL v3](License). The rating-card lookup, settings shell and build setup still come from Streaming enhanced; see [NOTICE](NOTICE) for what was kept and what changed.

This product uses the TMDb API but is not endorsed or certified by TMDb. streamBuddy is an independent project and is not affiliated with or endorsed by Letterboxd, IMDb, Netflix, Amazon or Warner Bros. Discovery. Ratings belong to their respective sites.

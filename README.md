<div align="center">
<img src="src/assets/logo.png" height="72">

# streamBuddy

**Letterboxd and IMDb ratings, right on Netflix, Prime Video and HBO Max.**

</div>

streamBuddy puts a small score on every title card. Films show their Letterboxd average and series show their IMDb rating, coloured on a scale tuned to how each site's ratings are actually spread. Connect your Letterboxd profile to add friends' ratings, marks for films you've seen or watchlisted, and a nudge to rate a film as the credits roll.

## Features

- **Ratings on every card.** Letterboxd for films and IMDb for series, on home rows, search results and title pages.
- **Friends' ratings.** Your Letterboxd friends' average, and who rated it, on each film.
- **Your diary.** Films you've logged show your stars, and watchlisted films are marked. Watched films can fade back.
- **Title-page panel.** Letterboxd average, your status, friends' stars and a one-click "add to watchlist".
- **Episode ratings.** IMDb ratings for every episode of the season you're viewing.
- **Find the good stuff.** Best-in-row highlights, an optional cut-off that hides low-rated titles, and sort-by-rating on search pages.
- **Stats.** Weekly watch time by service, plus watchlist films that are streaming now.
- **Playback controls.** Skip intros, recaps, credits and ads, and adjust speed, inherited from Streaming enhanced.

## Setup

1. Install streamBuddy. A welcome page opens.
2. Enter your Letterboxd username. This is optional, but it enables friends, your diary and your watchlist.
3. Paste a free TMDb key. The [in-extension guide](src/ui/options-page/pages/Guide.vue) walks through getting one in about two minutes.

Both values stay in your browser. See [PRIVACY.md](PRIVACY.md).

## Building

```bash
npm install
npm run build:chrome   # dist/chrome: your own unpacked copy; reads TMDB_TOKEN and LETTERBOXD_USERNAME from .env
npm run build:release  # release/chrome and a store zip with no personal keys baked in
npm test
```

## Credits and licence

streamBuddy is built on [Streaming enhanced](https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip) by Marvin Krebber (Dreamlinerm), and like the original it is licensed under the [GNU GPL v3](License). See [NOTICE](NOTICE) for details of the original work and what changed.

This product uses the TMDb API but is not endorsed or certified by TMDb. streamBuddy is an independent project and is not affiliated with or endorsed by Letterboxd, IMDb, Netflix, Amazon or Warner Bros. Discovery. Ratings belong to their respective sites.

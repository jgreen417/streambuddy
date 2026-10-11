# streamBuddy privacy policy

_Last updated: 12 October 2026_

streamBuddy is a browser extension that shows film and TV ratings on streaming sites. It has no server, no analytics and no advertising. The developer never receives your data.

## What streamBuddy stores, and where

All of the following stays in your browser's extension storage. "Synced" items travel only through your own browser account's sync, if you have it turned on.

| Data | Where | Why |
|---|---|---|
| Your settings | Synced | So your preferences follow you between devices |
| Your Letterboxd username and TMDb key | Synced | To look up ratings and your Letterboxd profile |
| A cache of title lookups and ratings | This device | So ratings load instantly and sites aren't asked twice |
| A copy of your public Letterboxd diary and watchlist | This device | To mark films you've seen or watchlisted |
| Watch time per day and service, and titles you've recently seen on screen | This device, last 120 days | For the Stats tab |
| Titles you choose to hide | This device | To hide them |

Uninstalling streamBuddy deletes all of it. You can also erase it with "Reset" on the Backup page in settings.

## What streamBuddy sends, and to whom

streamBuddy contacts these services directly from your browser, only to show ratings:

- **The Movie Database (api.themoviedb.org):** the titles shown on the streaming page, with your TMDb key, to identify each film or show.
- **Letterboxd (letterboxd.com):** requests for film pages, and for your public profile, diary, watchlist and friends' ratings if you've entered a username. When you choose "Add to watchlist", it acts through the Letterboxd account you're signed in to, and only after you confirm.
- **IMDb (caching.graphql.imdb.com):** IMDb IDs, to fetch series and episode ratings.
- **MyAnimeList (api.myanimelist.net):** anime titles, for Crunchyroll ratings.

These requests go straight from your browser to those services, under their own privacy policies. streamBuddy doesn't send your browsing, watch history or any identifier to the developer or anyone else.

## What streamBuddy doesn't do

- It doesn't sell or share data.
- It doesn't use data for advertising, credit or anything unrelated to showing ratings.
- It runs only on the supported streaming sites: Netflix, Prime Video (including Amazon's sites, where Prime Video is hosted), HBO Max, Disney+, Paramount+ and Crunchyroll. On those pages it reads title names and the player's controls, to show ratings and skip intros or ads.
- It doesn't collect your name, email, payment details or passwords.

## Contact

Questions: open an issue at https://github.com/jgreen417/streambuddy/issues.

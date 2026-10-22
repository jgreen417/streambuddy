# streamBuddy privacy policy

_Last updated: 22 October 2026_

streamBuddy is a browser extension that shows film and TV ratings on streaming sites. It has no server, no analytics and no advertising. The developer never receives your data.

## What streamBuddy stores, and where

All of the following stays in your browser's extension storage. "Synced" items travel only through your own browser account's sync, if you have it turned on.

| Data | Where | Why |
|---|---|---|
| Your settings | Synced | So your preferences follow you between devices |
| Your Letterboxd username and your own TMDb key, if you add one | Synced | To look up ratings and your Letterboxd profile |
| A cache of title lookups and ratings | This device | So ratings load instantly and sites aren't asked twice |
| A copy of your public Letterboxd diary and watchlist | This device | To mark films you've seen or watchlisted |
| Watch time per day and service, and estimated time saved by skipping | This device, last 120 days | For the Stats tab |
| Recently displayed titles and their streaming-page URLs | This device, last 7 days, up to 25 titles | For the Stats tab |
| Titles you choose to hide | This device | To hide them |
| Titles you corrected with "Not this title?" (the card's title and the TMDb title you picked) | This device | To keep showing the right rating |

Uninstalling streamBuddy deletes all of it. You can also erase it with "Reset" on the Backup page in settings.

Removing streamBuddy opens a short, optional form asking why, and "Request a service" opens a form asking which streaming service to add next. Both are Google Forms. streamBuddy adds nothing to either link, so the developer only sees what you type. Like any website, Google receives the usual details of a page visit, such as your IP address and browser, under [Google's privacy policy](https://policies.google.com/privacy).

## What streamBuddy sends, and to whom

streamBuddy contacts these services directly from your browser, only to show ratings:

- **The Movie Database (api.themoviedb.org):** the titles shown on the streaming page, with streamBuddy's built-in TMDb key or your own, to identify each film or show; and, when you open a badge's card inspector, that title's TMDb ID and your region, to list where else it's streaming, and anything you search for under "Not this title?".
- **Letterboxd (letterboxd.com):** requests for film pages, and for your public profile, diary, watchlist and friends' ratings if you've entered a username.
- **IMDb (caching.graphql.imdb.com):** IMDb IDs, to fetch series and episode ratings.

These requests go straight from your browser to those services, under their own privacy policies. streamBuddy doesn't send your browsing, watch history or any identifier to the developer or anyone else.

## What streamBuddy doesn't do

- It doesn't sell data or share it for advertising. The service requests and browser sync described above support its features.
- It doesn't use data for advertising, credit or anything unrelated to its ratings, playback, watchlist and local statistics features.
- It runs only on Netflix, Prime Video (including Amazon's sites, where Prime Video is hosted), HBO Max and Disney+. On those pages it reads title names and the player's controls, to show ratings and to skip intros or ads. On HBO Max, Prime Video and Disney+ it also reads the service's own playback responses for the time the end credits start, so the review pill appears on cue; that time is kept only while the page is open and is never sent anywhere.
- It doesn't collect your name, email, payment details or passwords.

streamBuddy's use and transfer of information adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. The developer does not receive or read extension user data. Data is transferred only to the services described above to provide the features you use, and through your browser account's sync when enabled.

## Contact

Questions: open an issue at https://github.com/jgreen417/streambuddy/issues.

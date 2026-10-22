# Changelog

# streamBuddy 1.0.6

The little things.

- Hover or focus a rating badge for the card inspector: friends' stars, the number of ratings, and where else the title is streaming. “Not this title?” fixes a wrong match and remembers it.
- A bedtime pill in the player: see when the title ends, set a 15/30/45/60-minute sleep timer, or stop after this episode or film.
- The credits notice now tells you what is up next and how good it is.
- Quiet browsing mutes autoplay previews on every service; Netflix's Top 10 row and games rows can be hidden too.
- The best-rated episode of a season gets a tangerine star and ring.
- A score-only badge for dense rows.
- Skips can wait 1 or 2 seconds, and season premieres can keep their recap.
- Diagnostics in settings: cache size, profile sync, fixed matches, and local-only controls.

# streamBuddy 1.0.5

Disney+ is here.

- Disney+: rating badges on posters and tiles, IMDb scores beside each episode, the review pill when a film's end credits start, and intros and recaps skipped.
- Prime Video on Amazon's sites in Canada, France, Italy, Spain and India, including season and episode names in French, Italian, Spanish and Hindi.
- The popup only names a service on sites where streamBuddy actually runs.

# streamBuddy 1.0.4

Request your service, rate streamBuddy, and a tidier look.

- Watching somewhere streamBuddy doesn't cover yet? The popup says so on that site, and the settings pages and popup have a "Request a service" link to a short form.
- A "Rate streamBuddy" card in the popup's Stats tab once you've used it for a few days. It goes away once you've opened it.
- After an update, the popup shows what's new until you open or dismiss it.
- The speed control steps aside once the film is over and the review pill is up.
- A tidier look: the review card, popup and settings pages line up on one grid, episode ratings match the card badges, Prime Video badges line up along each row, and the player's notices and welcome page use streamBuddy's own font and colours.
- A "Report a problem" link in settings, and an optional short survey if you remove streamBuddy.
- The Backup page is fully translated, and Chinese and Brazilian Portuguese browsers get their own translation.

# streamBuddy 1.0.3

- Ratings work straight after install: streamBuddy now comes with a shared TMDb key. Adding your own free key is optional and replaces it, and if TMDb ever pauses the shared key the popup says so and asks for one.
- Famous films no longer miss their rating when TMDb's first match is an unrated fan film or an unreleased show (such as Star Wars and the first Harry Potter).
- A quieter console: no debug logging in store builds, and no errors when TMDb, Letterboxd or IMDb is briefly unreachable (those titles are retried as before).
- The popup no longer asks for a missing icon.

# streamBuddy 1.0.2

- When a film's credits start, a small "Review" pill appears beside the player with your friends' average. Open it to see who rated the film, then rate it on Letterboxd in one click. On Netflix it sits bottom left, clear of the next-title preview.
- Netflix episode cards (such as pilot rows) now show their series' rating.
- Prime Video: large-card badges stay put after a hover, and unrated cards are no longer rechecked every second.
- Removed the rating panel and "Add to Letterboxd watchlist" button from title pages on Netflix, Prime Video and HBO Max, along with their settings. Card badges and episode ratings are unchanged.

# streamBuddy 1.0.1

- A new look: a new logo (two friends on the couch), a warm dark palette with tangerine highlights and the Bricolage Grotesque typeface in the popup and settings.
- Rating badges are now a single cream chip in the same typeface: a bold score in a pill coloured by how it ranks, with labelled "friends" and "you" lines beside it, or "IMDb"/"TMDb" when the score isn't from Letterboxd. The badge's corners follow each service's card corners. The exact score and source are in the tooltip.
- New settings: "Ratings from" picks Letterboxd, IMDb or TMDb (or Letterboxd and IMDb together, as before), and "Friends' ratings" picks labelled lines, a dot per friend, three dots or hidden, and "Badge look" switches the cream chip for Liquid Glass with a slider from clear to frosted.
- Removed the orange best-in-row highlight and its setting.
- Housekeeping: removed leftovers from Streaming enhanced, renamed the icon files and updated dependencies.

# streamBuddy 1.0.0

First release of streamBuddy, which started from Streaming enhanced 1.1.108 by Dreamlinerm.

- Letterboxd ratings on films and IMDb ratings on series, on Netflix, Prime Video and HBO Max title cards
- Friends' Letterboxd ratings, plus marks for films you've seen or watchlisted
- Rating panels on title pages, IMDb ratings for every episode, best-in-row highlights and an optional low-rating cut-off
- Search-page ratings with sort by rating
- Add to your Letterboxd watchlist from a title page, and a reminder to rate as the credits roll
- Weekly watch-time stats
- Two-step setup: your Letterboxd username and a free TMDb key, stored only in your browser
- Skips intros, recaps, credits, ads and "Still watching?", each with a notice and Undo
- Per-show skip rules, an episode-1 intro option, a speed pill with shortcuts, and an optional autoplay limit
- Hides Netflix's mobile-games rows, and optionally Prime Video titles that cost extra

# Before streamBuddy

streamBuddy started from Streaming enhanced 1.1.108. Its history is at https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip/blob/main/CHANGELOG.md

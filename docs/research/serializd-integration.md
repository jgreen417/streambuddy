# Serializd integration: feasibility and implementation design

Status: research complete; production integration awaits an authenticated data-access contract.
Verified: 26 October 2026. This PR adds no provider settings, permissions or account handling.

## Decision

Serializd fits streamBuddy's TV use case, but its data cannot currently be treated like Letterboxd's public pages. Anonymous requests to three concrete JSON routes returned HTTP 401. The website returned a Cloudflare challenge. Ship the three independent UI fixes separately; implement this integration after proving authenticated access, pagination, score scales and entity matching. No account credentials were requested or used during this investigation.

## Evidence and reproduction

Run `node scripts/probe-serializd.mjs` (Node 18+). It makes four sequential GET requests, each with a 12-second timeout, and prints status classifications. It does not sign in, write ratings or expose response bodies. HTTP errors are observations; a successful response alone does not prove the schema is usable.

| Route | Observed result | Meaning |
| --- | --- | --- |
| `https://www.serializd.com/show/The-Office-2316` | 403, Cloudflare challenge | Public HTML scraping is unreliable from this environment |
| `https://serializd.onrender.com/api/show/2316` | 401 JSON, Unauthorized | API route requires authentication |
| `https://serializd.onrender.com/mobile/page/show_v2_part_1/2316` | 401 JSON, Unauthorized | Candidate community show-rating route requires authentication |
| `https://serializd.onrender.com/mobile/page/show/2316/season/1/episode_part_1/5` | 401 JSON, Unauthorized | Candidate community episode-rating route requires authentication |

Sources inspected:

- [Serializd homepage](https://www.serializd.com/): describes ratings, reviews, friends, tracking and TMDB metadata.
- [The Office](https://www.serializd.com/show/The-Office-2316) and [season 1](https://www.serializd.com/show/The-Office-2316/season/7240/1): public show/season identities. Search-rendered content was available even though direct requests were challenged. Do not confuse the season entity ID `7240` with season number `1`.
- [Kometa implementation](https://github.com/Kometa-Team/Kometa/blob/master/modules/serializd.py): logs in through `SerializdClient`, requests the two mobile routes above, and reads `averageRating`. It also reads personal episode reviews from `episode_part_2`. This is primary evidence of an existing consumer, not an official Serializd API guarantee.
- [serializd-export implementation documentation](https://github.com/belepod/serializd-export): identifies the `/api` backend and email/password authentication. It is an unofficial consumer, not evidence that streamBuddy may reuse a user's session.

These upstream branches can change; the observations above record this investigation's results. No official integration contract, OAuth flow, rate limit or third-party access approval was established. Policy pages also returned 403, so access terms remain unverified; this is not a claim that integration is prohibited.

## Capability assessment

| Capability | Evidence | Required proof before shipping |
| --- | --- | --- |
| Community show score | Existing consumer reads `averageRating` by TMDB show ID | Authenticated schema, scale, count and canonical URL |
| Community episode score | Consumer uses show ID + season/episode numbers | Correct episode mapping, missing/special episodes and bounded batch retrieval |
| Personal episode rating | Consumer reads logged-in episode reviews | Account identity and which review represents the current rating |
| Watched state / watchlist | Website feature and existing consumer support | Read endpoints, pagination, private accounts and update semantics |
| Friends' ratings | Website social features | Exact endpoint, pagination, permissions and aggregate semantics; not yet verified |
| Review links | Show and season pages exist | Canonical episode URLs and correct destination for each rating scope |

Do not infer a five-star response scale, multiply scores, or equate missing scores with zero until actual authenticated responses establish the contract. Do not copy IMDb's empirically calibrated colour percentiles to Serializd without data.

## Proposed user experience

Keep movies, shows and episodes independently configurable. A person can prefer Letterboxd for films, Serializd for series, and IMDb for individual episodes. Keep provider choice separate from connecting a profile: a community score and a personal rating serve different purposes.

- Movie source: preserve current Letterboxd / IMDb / TMDB behavior.
- Show source: prefer IMDb or Serializd; allow TMDB-only as today.
- Episode source: IMDb or Serializd, independently of show source. If no supported episode fallback exists, omit the badge rather than use a show score.
- Fallback: an explicit ordered provider chain. Every badge and inspector names the provider that actually supplied its score.
- Profiles: separate Letterboxd and Serializd connection and disconnect controls. Friends and personal/watchlist indicators use the matching account.
- TV review prompt: target the episode just completed. A show-level prompt belongs at a confirmed finale; never substitute a show rating for an episode rating. Account for autoplay, credits skips and specials.

The current `rateOnCredits` and limited-series Letterboxd behavior remain the default until a deliberate TV-prompt preference is enabled. Opening the source site is the action; streamBuddy does not submit ratings or mark episodes watched automatically.

## Implementation boundaries

1. `src/utils/ratings.ts` / a dedicated Serializd provider module: validate unknown responses at the boundary. Return typed results distinguishing no rating, authentication required, transient failure and success. Keep provider, native scale, rating scope and canonical URL with every result.
2. `src/background/index.ts` and message types: perform provider requests in the background, deduplicate in-flight work, bound concurrency and retry with backoff. Add only verified hosts to both browser manifests; inspect Chrome and Firefox cookie/permission behavior independently.
3. `src/utils/lookup.ts`: resolve TV identities through TMDB IDs. Match episodes by show + season + episode, not title guessing. Use verified season entity IDs only when forming canonical URLs.
4. `src/stores/storeTypes.ts`, storage migration and `ExperiencePreferences.vue`: replace the single source enum with versioned movie/show/episode preferences and explicit fallback chains. Migrate every old value before any lookup occurs.
5. Content-script caches and background episode caches: key by entity, rating scope, effective provider chain, schema version and relevant account identity. Clear affected in-memory and persisted entries when preferences or accounts change. Prevent late responses from the old selection repainting badges.
6. Badge, episode, inspector, stats and credits renderers: remove IMDb-only labels, links, scale assumptions and Letterboxd-only account assumptions where TV uses Serializd. Preserve star-only best-episode styling on all supported services. Rank a season using one provider and one scope; do not mix provider scales to select its best episode.
7. Profile storage: store session material locally, exclude it from synced settings and backup exports, and clear it and account-scoped caches on disconnect. Prefer a documented authorization flow; any password/session integration requires a reviewed design based on the proven service contract.

## Migration contract

| Legacy `ratingSources` | Movies | Shows | Episodes |
| --- | --- | --- | --- |
| `both` | Letterboxd → IMDb → TMDB | IMDb → TMDB | Preserve current IMDb lookup |
| `letterboxd` | Letterboxd → TMDB | TMDB | Preserve current IMDb lookup |
| `imdb` | IMDb → TMDB | IMDb → TMDB | Preserve current IMDb lookup |
| `tmdb` | TMDB | TMDB | Preserve current IMDb lookup |

Today episode lookups independently use IMDb even when the general source setting excludes it. Preserve that observed behavior during migration; offer explicit episode changes afterward. Do not silently opt existing users into Serializd requests. Keep a separate disabled episode setting disabled.

## Verification and release gates

Before enabling Serializd:

- Verify a legitimate authenticated flow in Chrome and Firefox, session expiry, disconnect, and behavior when signed out. Record sanitized response fixtures without credentials or private reviews.
- Prove show, season, episode, special, remake and translated-title matching. Compare displayed source scores and URLs against the actual site.
- Verify scale/count parsing, zero/unrated distinction, malformed responses, 401/403/404/429/5xx and timeout handling. A transient failure must not pin a fallback score for a month.
- Test all four migration rows, backup round trips, live preference changes, stale in-flight responses, provider/account cache isolation and fallback labeling.
- Validate friends' pagination and distinguish unavailable/private from zero friends. Do not claim friends parity until this passes.
- Run browser geometry and visual checks for badges, star spacing, long source labels, inspector, settings and credits on every supported service. Verify review links without submitting a rating.
- Run the full unit suite, application and E2E typechecks, dependency checks, Chrome/Firefox release builds and CI screenshot review. Use a small bounded request budget to validate actual service behavior.

If the authenticated contract cannot be verified, keep the integration disabled and retain this research as the basis for the next implementation PR. A credentials prompt or a nonfunctional source dropdown is not a substitute for that proof.

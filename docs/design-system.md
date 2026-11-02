# streamBuddy design system

streamBuddy's look is called "Buddy": a warm couch-dark background, popcorn-white text, smoked glass for anything that
floats over a site, tangerine for the logo, a calmer clay for the main action, and a dusty colour scale that only ever
means a score. Friends' ratings are what makes
streamBuddy different, so friends get faces and dots, never a separate panel.

## Where the tokens live

`src/design/tokens.ts` is the only place a colour, typeface, shadow, radius, spacing step or animation curve is defined.

| Where it's drawn                                   | How it gets the tokens                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Popup and settings pages                           | `--sb-*` CSS variables from `src/design/tokens.css`, imported by `src/assets/base.css`. Tailwind classes too: `bg-sb-surface`, `text-sb-text-muted`. |
| daisyUI components (buttons, inputs)               | The dark theme in `base.css` maps daisyUI's roles onto the `--sb-*` variables.                                                           |
| Badges, episode chips, credits pill (on the sites) | `page-feature-styles.ts` sets the `--sb-*` variables on streamBuddy's own elements, never on the page's `:root`. The card badge's inline styles import the values from `tokens.ts`. |
| Skip notices and speed pill (in the player)        | `overlay.ts` sets the variables on its shadow root.                                                                                      |

`tokens.css` is generated. After changing `tokens.ts`, run `npm run tokens` and commit both. A unit test
(`src/tests/design/tokens.test.ts`) fails when `tokens.css` is out of date, or when a raw colour (`#hex`, `rgb()`,
`rgba()`) appears anywhere in `src` outside `src/design`.

To add a colour: add it to `palette` if it's new, then give it a role in `color` named for what it does
(`lineHover`, not `grey3`). Use the role, not the palette entry, in components.

## Colour

### Palette

| Name      | Value     | Used for                                            |
| --------- | --------- | --------------------------------------------------- |
| couch     | `#1b1918` | backgrounds; dark ink on light chips                |
| couchDeep | `#151312` | daisyUI's neutral                                   |
| field     | `#262220` | inputs and selects                                  |
| well      | `#2a2421` | wells and round buttons in the credits pill         |
| button    | `#2b2724` | buttons streamBuddy adds to a site                  |
| line      | `#3a3431` | solid lines in the credits pill                     |
| popcorn   | `#fbf4ec` | text; switches that are on; most tints, as an alpha |
| stone     | `#a39b93` | muted and quiet text                                |
| sand      | `#cfc6bc` | soft text on dark glass                             |
| tangerine | `#ff7a45` | the logo only                                       |
| clay      | `#e38056` | the accent: primary actions, links, stars           |
| apricot   | `#ffb38f` | keyboard focus rings                                |
| sky       | `#8ec5ff` | "you" and "watchlist" on the badge                  |
| mint      | `#7ad9a0` | good news: connected, faster playback               |
| coral     | `#ff8a8a` | problems                                            |

Surfaces and lines on the dark background are popcorn at a low alpha (`surface` 6%, `surfaceRaised` 10%), so they
warm whatever they sit on. Lines come in five steps: `hairline` 7% (group borders and dividers), `lineRaised` 12%
(raised edges and fields), `lineField` 15% (selects), `lineHover` 18% and `lineActive` 28%. Text that must stay
readable never goes darker than `stone` (darker greys failed WCAG AA on these surfaces).

What's selected (the active tab, the picked option, the current settings page) is `selected`, popcorn at 12%: a
lighter step, never a solid orange fill. A switch that's on is popcorn with a couch knob (`switchOn`, `switchKnobOn`).

Smoked glass: `glassPanel` (couch at 78%) with `blur.panel` behind the credits card and the hover card, edged with
`lineGlass` and with `wellGlass` for round buttons on it.

### Score scale

`scoreScale`, dusty so it sits on glass without shouting: red `#f1a99e`, orange `#e2b38b`, yellow `#d3bc7b`, light
green `#aec88f`, green `#97ccaa`.
`ratings.ts` picks the band so each colour covers a similar share of what's streaming. Colour on a badge always means
score: nothing else on a badge uses these colours, and a score is always dark ink on its band colour, in both badge
looks (`scoreInk`). Too few votes, or no score, is `badgeUnrated` grey.

### Friends

`friendColors` (tangerine, sky, sun, mint, lilac) colour friends' faces and dots, picked from the friend's name so a
friend keeps their colour from card to credits. The first three are the fixed "trio" dots.

### Services

`serviceColors` holds each service's own brand colour, for the service chips on the hover card. The watch-time chart
uses `chartSteps` (popcorn down to grey, most watched first) so it doesn't turn into a rainbow.

## Type

Bricolage Grotesque everywhere (`font.ui` on extension pages). On streaming sites the badge and credits pill load the
bundled file under the family name `"streamBuddy Bricolage"` (`font.page`) so a site's own fonts can't clash. The
player overlay loads the same bundled file into its shadow root. Numbers in scores use tabular figures.

| Use            | Size / weight         |
| -------------- | --------------------- |
| Popup body     | 13px / 400            |
| Popup wordmark | 17px / 800, -0.035em  |
| Labels, meta   | 12px / 500            |
| Settings body  | 14px / 400            |
| Page heading   | 22px / 800, -0.03em   |
| Badge score    | 1.15em / 800, -0.02em |

## Shape, depth and motion

- Radius: `xxs` 2px (bars, the episode chip's fallback), `xs` 5px, `sm` 6px (inputs, tabs), `md` 8px (buttons), `lg`
  10px (groups), `xl` 12px (cards in the credits pill), `pill` 999px, and the credits pill's own `credits` 30px
  (closed) and `creditsOpen` 22px (opened into a card). The badge's radius is concentric with the card it sits on
  (card radius minus its 3px inset).
- Spacing (`--sb-space-*`): `xxs` 2px, `xs` 4px, `sm` 6px, `md` 8px, `lg` 12px, `xl` 16px for padding,
  margins and gaps, and three named insets: `edge` 14px (the popup's and the credits pill's outer edge), `inset` 12px
  (from a group's border to its content) and `card` 18px (above the credits card's content). Sizes of things (toggles,
  icons, the badge's 3px inset) stay as plain values.
- Shadow and blur: the badge is smoked glass (`badgeBg` couchDeep at 62% with `blur.badge`); `shadow.badge` is a
  faint light edge and a soft drop that lifts it off any artwork. Glass panels use `shadow.panel`. Floating panels (`float`, `review`) use soft shadows. Liquid Glass (`glass`, `shadow.glass`) is a blurred
  tint with a hairline edge; its frost setting runs from clear to frosted.
- Motion: `ease.settle` for things settling into place (tabs, the badge appearing, bars growing), `ease.unfold` for the
  credits pill opening, `ease.arrive` for it appearing. Everything respects `prefers-reduced-motion`.

## Components

- **Card badge** (`badge.ts`): smoked glass chip 3px from the artwork's edges (top-right on Netflix, bottom-right
  on Prime and Max), the score in its band colour, and beside it a labelled column: "friends", sky "you" or
  "watchlist". IMDb and TMDb scores show their source name in that column. Two looks: Smoked and Liquid
  Glass, which swaps the `--sb-badge-*` variables to light-on-glass.
- **Episode chip** (`page-feature-styles.ts`): the card badge in miniature, with the same two looks.
- **Credits pill** (`credits-review.ts`): a collapsed pill at the end credits that opens into a compact glass card:
  the title, one line with your friends' average, their faces, stars, a clay primary action and a quiet "Not now". The
  × folds it back into the pill.
- **Popup** (`popup.css`): one list of rows on a `surface` with `hairline` dividers, popcorn switches, and the
  service the settings apply to picked in the header.
- **Player overlay** (`overlay.ts`): dark glass pills for skip notices and speed.

There is no rating panel on title or detail pages, by design.

## Checking a change

The visual checks (`e2e/visual`, run in CI on every pull request) screenshot every badge look, the episode chips, the
credits pill, the player's skip notices and speed pill, the popup and the settings pages. A token change that moves a pixel shows up there; if it's intended,
add the **accept-visuals** label to the pull request.

## Known gaps

- daisyUI's light theme in `base.css` is inherited from the original extension and never shown.
- A few near-duplicate greys (`well` and `button`, `line` and `buttonHover`) could be merged.

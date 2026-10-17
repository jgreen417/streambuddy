# streamBuddy design system

streamBuddy's look is called "Buddy": a warm couch-dark background, popcorn-white text, tangerine for the brand and
for anything switched on, and a pastel colour scale that only ever means a score. Friends' ratings are what makes
streamBuddy different, so friends get faces and dots, never a separate panel.

## Where the tokens live

`src/design/tokens.ts` is the only place a colour, typeface, shadow, radius or animation curve is defined.

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
| popcorn   | `#fbf4ec` | text; the badge's sticker; most tints, as an alpha  |
| stone     | `#a39b93` | muted and quiet text                                |
| sand      | `#cfc6bc` | soft text on dark glass                             |
| tangerine | `#ff7a45` | the brand, primary actions, anything switched on    |
| apricot   | `#ffb38f` | keyboard focus rings                                |
| sky       | `#8ec5ff` | links; "you" on the badge                           |
| mint      | `#7ad9a0` | good news: connected, faster playback               |
| coral     | `#ff8a8a` | problems                                            |

Surfaces and lines on the dark background are popcorn at a low alpha (`surface` 6%, `surfaceRaised` 10%,
`line` 8%), so they warm whatever they sit on. Text that must stay readable never goes darker than `stone`
(darker greys failed WCAG AA on these surfaces).

### Score scale

`scoreScale`: red `#ff8a7a`, orange `#ffb168`, yellow `#f2c94c`, light green `#b5e07a`, green `#7ad9a0`.
`ratings.ts` picks the band so each colour covers a similar share of what's streaming. Colour on a badge always means
score: nothing else on a badge uses these colours, and a score is always dark ink on its band colour, in both badge
looks. Too few votes, or no score, is `badgeUnrated` grey.

### Friends

`friendColors` (tangerine, sky, sun, mint, lilac) colour friends' faces and dots, picked from the friend's name so a
friend keeps their colour from card to credits. The first three are the fixed "trio" dots.

### Services

`serviceColors` holds each service's own brand colour, for the watch-time chart only.

## Type

Bricolage Grotesque everywhere (`font.ui` on extension pages). On streaming sites the badge and credits pill load the
bundled file under the family name `"streamBuddy Bricolage"` (`font.page`) so a site's own fonts can't clash. The
player overlay uses the system font (`font.system`). Numbers in scores use tabular figures.

| Use            | Size / weight         |
| -------------- | --------------------- |
| Popup body     | 13px / 400            |
| Popup wordmark | 17px / 800, -0.035em  |
| Labels, meta   | 12px / 500            |
| Settings body  | 14px / 400            |
| Page heading   | 22px / 800, -0.03em   |
| Badge score    | 1.15em / 800, -0.02em |

## Shape, depth and motion

- Radius: `xs` 5px, `sm` 6px (inputs, tabs), `md` 8px (buttons), `lg` 10px (groups), `xl` 12px (cards in the credits
  pill), `pill` 999px. The badge's radius is concentric with the card it sits on (card radius minus its 3px inset).
- Shadow: the badge is a sticker, not glass: `shadow.sticker` is a hard 3px drop with no blur, which lifts it off any
  artwork. Floating panels (`float`, `review`) use soft shadows. Liquid Glass (`glass`, `shadow.glass`) is a blurred
  tint with a hairline edge; its frost setting runs from clear to frosted.
- Motion: `ease.settle` for things settling into place (tabs, the badge appearing, bars growing), `ease.unfold` for the
  credits pill opening, `ease.arrive` for it appearing. Everything respects `prefers-reduced-motion`.

## Components

- **Card badge** (`shared-functions.ts`): popcorn chip 3px from the artwork's edges (top-right on Netflix, bottom-right
  on Prime and Max), the score in its band colour, and beside it a labelled column: tangerine "friends", sky "you" or
  "watchlist". IMDb and TMDb scores show their source name in that column. Two looks: Classic (sticker) and Liquid
  Glass, which swaps the `--sb-badge-*` variables to light-on-glass.
- **Episode chip** (`page-feature-styles.ts`): the card badge in miniature, with the same two looks.
- **Credits pill** (`credits-review.ts`): a collapsed pill at the end credits that opens into a card of friends'
  ratings. Tangerine primary action, ghost secondary.
- **Popup** (`popup.css`): groups of rows on a `surface` with `hairline` borders, tangerine toggles, a segmented
  control with a popcorn indicator.
- **Player overlay** (`overlay.ts`): dark glass pills for skip notices and speed.

There is no rating panel on title or detail pages, by design.

## Checking a change

The visual checks (`e2e/visual`, run in CI on every pull request) screenshot every badge look, the episode chips, the
credits pill, the popup and the settings pages. A token change that moves a pixel shows up there; if it's intended,
add the **accept-visuals** label to the pull request.

## Known gaps

- The install page's welcome note still uses the old Letterboxd green (`welcomeWash`, `welcomeLine`).
- The player overlay uses the system font rather than Bricolage.
- daisyUI's light theme in `base.css` is inherited from the original extension and never shown.
- A few near-duplicate greys (`well` and `button`, `line` and `buttonHover`) could be merged.

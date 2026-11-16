# Design: Postsound

The locked design system for every Postsound surface. Read this file before any UI change.
Extend or amend this file. Do not restyle one surface on its own.

## Genre
modern-minimal

## Surfaces
- Toolbar popup (`popup.html`, `popup.css`): 320 px. "Live card" since v1.1.0: the cover on top, a big title and a coral play key, two plain settings rows, three link chips. The v1.0 style is kept in `design/popup-v1.css`.
- Support page (`about.html`, `about.css`): title left, lede right. Support and Contact sit beside the report form. A ruled help list and a one-line footer follow.
- Overlay on Instagram photos (`content.css`): a song pill at the top left and a sound button at the bottom right.
- Store images (`store/src/frame.html`): dark paper, the real overlay and popup inside generic post cards.
- Product site (`site/index.html`, `site/home.css`, `site/home.js`): "Live feed". A night-room dark theme. The hero is a working demo feed: the post in the middle plays, with the real overlay (`content.css`) on each photo and the real popup (`popup.css`) in a frame beside it (`site/popup-demo.html`). Demo tunes come from `site/demo-audio.js` (Web Audio, no song files). The old page is at `/classic`. Concept drafts sit in `site/concepts/` and are not deployed.

## Theme: Coral
Tokens live in `tokens.css`. Pages use `var(--token)` only.

- `--color-paper` oklch(97.4% 0.004 60), dark oklch(17% 0.006 50)
- `--color-surface` oklch(99.6% 0.002 60), dark oklch(20.5% 0.007 50)
- `--color-ink` oklch(21.5% 0.010 50), dark oklch(95.5% 0.006 60)
- `--color-ink-2` oklch(45.5% 0.012 50), dark oklch(73% 0.010 60)
- `--color-rule` oklch(89.5% 0.006 60), dark white at 9 %
- `--color-accent` oklch(63.5% 0.185 36), dark oklch(71% 0.165 38). Coral, not Instagram pink.
- `--color-focus` equals the accent.

The accent has these uses only: the on switch, the "Now playing" label, the popup play key, the Buy me a sticker link or chip, the heart on the support page, and on the site the word "song" and the kicker dot.
Primary buttons are ink pills, not accent pills. The popup play key is the one coral button.

The overlay keeps its own `--ps-*` tokens in `content.css`, because it lives inside Instagram's page. They are an ink pill at 78 % and paper text.

## Typography
- Display and body: Geist Variable, bundled in `fonts/` under the OFL. One family, as modern-minimal asks.
- Display 600, tracking -0.035em. Headings 600, tracking -0.015em. Body 400. Labels 500 to 550.
- The overlay uses the system font stack that Instagram uses. Then it reads as part of Instagram's UI.
- Headings are never italic.

## Icons
Lucide only, inlined, stroke 2. The licence is in `icons/LICENSE-lucide.txt`.

## Spacing and shape
- 4 pt scale: `--space-3xs` 4 px up to `--space-2xl` 72 px.
- Card radius 12 px, input radius 10 px, buttons and chips are pills.
- One containment layer. No card inside a card.

## Motion
- `--ease-out` cubic-bezier(0.16, 1, 0.3, 1). Press 100 ms, colour 160 ms, switch 240 ms.
- Press scale on buttons. Three equalizer bars while a song plays. A pulse on the sound button and the popup play key while the browser blocks audio. On the site, posts away from the middle fade, and the sticker tilts on hover. Nothing else moves.
- Reduced motion: no transitions, no animations.

## Microinteractions
- Silent success. The copy button turns into a check for 1.6 s. There are no toasts.
- Reporting opens a prefilled email and shows one status line with a fallback address.
- Field errors appear on submit and clear as soon as the value is valid.

## Banned here
Gradient washes, frosted glass, icon-tile grids, side-stripe cards, centred page layouts, emoji, and re-drawn browser chrome in store images.

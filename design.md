# Design: Postsound

The locked design system for every Postsound surface. Read this file before any UI change.
Extend or amend this file. Do not restyle one surface on its own.

## Genre
modern-minimal

## Surfaces
- Toolbar popup (`popup.html`, `popup.css`): 320 px. A now-playing row, a settings list and one line of links.
- Support page (`about.html`, `about.css`): title left, lede right. Support and Contact sit beside the report form. A ruled help list and a one-line footer follow.
- Overlay on Instagram photos (`content.css`): a song pill at the top left and a sound button at the bottom right.
- Store images (`store/src/frame.html`): dark paper, the real overlay and popup inside generic post cards.

## Theme: Coral
Tokens live in `tokens.css`. Pages use `var(--token)` only.

- `--color-paper` oklch(97.4% 0.004 60), dark oklch(17% 0.006 50)
- `--color-surface` oklch(99.6% 0.002 60), dark oklch(20.5% 0.007 50)
- `--color-ink` oklch(21.5% 0.010 50), dark oklch(95.5% 0.006 60)
- `--color-ink-2` oklch(45.5% 0.012 50), dark oklch(73% 0.010 60)
- `--color-rule` oklch(89.5% 0.006 60), dark white at 9 %
- `--color-accent` oklch(63.5% 0.185 36), dark oklch(71% 0.165 38). Coral, not Instagram pink.
- `--color-focus` equals the accent.

The accent has four uses only: the on switch, the "Now playing" label, the Support link, and the heart on the support page.
Primary buttons are ink pills, not accent pills.

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
- Press scale on buttons. Three equalizer bars while a song plays. A pulse on the sound button while the browser blocks audio. Nothing else moves.
- Reduced motion: no transitions, no animations.

## Microinteractions
- Silent success. The copy button turns into a check for 1.6 s. There are no toasts.
- Reporting opens a prefilled email and shows one status line with a fallback address.
- Field errors appear on submit and clear as soon as the value is valid.

## Banned here
Gradient washes, frosted glass, icon-tile grids, side-stripe cards, centred page layouts, emoji, and re-drawn browser chrome in store images.

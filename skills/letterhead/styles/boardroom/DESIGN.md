---
name: Boardroom
description: Documents for decision-makers — cool paper, ink-navy authority, serif display over quiet sans, nothing rounder than 4px.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9840 0.0030 240)"
  foreground: "oklch(0.2200 0.0180 252)"
  card: "oklch(0.9920 0.0020 240)"
  card-foreground: "oklch(0.2200 0.0180 252)"
  popover: "oklch(0.9920 0.0020 240)"
  popover-foreground: "oklch(0.2200 0.0180 252)"
  primary: "oklch(0.3300 0.0750 255)"
  primary-foreground: "oklch(0.9840 0.0030 240)"
  secondary: "oklch(0.9500 0.0060 242)"
  secondary-foreground: "oklch(0.2800 0.0300 253)"
  muted: "oklch(0.9560 0.0050 242)"
  muted-foreground: "oklch(0.4450 0.0220 250)"
  accent: "oklch(0.9300 0.0110 248)"
  accent-foreground: "oklch(0.2600 0.0400 254)"
  destructive: "oklch(0.4900 0.1750 27)"
  destructive-foreground: "oklch(0.9900 0.0030 240)"
  border: "oklch(0.9000 0.0070 244)"
  input: "oklch(0.9000 0.0070 244)"
  ring: "oklch(0.3300 0.0750 255)"
  chart-1: "oklch(0.3300 0.0750 255)"
  chart-2: "oklch(0.5200 0.0700 245)"
  chart-3: "oklch(0.6800 0.0500 235)"
  chart-4: "oklch(0.5400 0.0800 80)"
  chart-5: "oklch(0.4200 0.0300 250)"
  sidebar: "oklch(0.9680 0.0040 241)"
  sidebar-foreground: "oklch(0.2200 0.0180 252)"
  sidebar-primary: "oklch(0.3300 0.0750 255)"
  sidebar-primary-foreground: "oklch(0.9840 0.0030 240)"
  sidebar-accent: "oklch(0.9300 0.0110 248)"
  sidebar-accent-foreground: "oklch(0.2600 0.0400 254)"
  sidebar-border: "oklch(0.9000 0.0070 244)"
  sidebar-ring: "oklch(0.3300 0.0750 255)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2rem, 4.5vw, 2.625rem)"
    fontWeight: 600
    lineHeight: 1.2
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "2px"
  md: "3px"
  lg: "4px"
  xl: "4px"

spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.125rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.125rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input-text:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
  nav-link-hover:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
---

# Boardroom

## 1. Overview

> "The document walks in wearing a pressed suit and says one thing clearly."

Boardroom is the register for documents whose reader decides: a board, an
executive sponsor, a client signing off on scope. Authority here comes from
restraint. The canvas is cool paper, deliberately not cream, because
cream-plus-serif is the reflex look of generated "elegant" documents and
this style refuses the reflex. Ink-navy is the only voice of emphasis.
Whitespace does the work decoration would otherwise pretend to do.

Key characteristics:

- Cool, faintly blue paper; never warm cream.
- Serif is a display instrument only. Running text stays in a quiet sans.
- One chromatic authority (ink navy). State colors appear only when a state
  is real.
- Corners at 4px or tighter. Softness reads as casual; this register is not
  casual.
- Rejects: decorative icons, badge walls, gradient anything, dashboard
  chrome in a reading document.

## 2. Colors

Primary group: `primary` (ink navy) carries headings' accents, links, and
the single most important number on the page. Neutral group: background /
card / muted / border form a narrow cool ramp; contrast between adjacent
steps is intentionally small so hairlines separate content without stripes.
State group: `destructive` is reserved for genuine risk or loss; there is
no decorative red. Chart group: navy-led ramp with one warm gold
(`chart-4`) for the series that must stand apart.

Emphasis has one color. If two elements on a screen
are both navy-accented, one of them is wrong.

The canvas never drifts warm. Any surface tint
stays in the 240–255 hue band.

## 3. Typography

Two families. A transitional serif (the Source Serif 4 stack) sets the
title and the h2 section headings; a neutral sans (the Inter stack) sets
everything else. The serif marks the occasion, the sans keeps the reading
plain. From largest to smallest: the title, h2 in the serif, h3 in sans
semibold, body, then small tracked labels. Mono is for identifiers and table
figures only.

Keep the serif to h1 and h2. Serif in body text, captions or labels spreads
the occasion thin until it no longer reads as one.

## 4. Elevation

Flat by default. Hairline borders (`border`) structure the page; the two
shadow tokens exist for the rare floating element (a sticky header on
mobile) and stay at whisper opacity. A boardroom document does not cast
dramatic shadows.

## 5. Components

- **Buttons:** rectangular with 3px corners, label typography, navy fill
  for the single primary action. Secondary buttons are tinted paper.
- **Cards and containers:** hairline border, 4px corners, generous padding.
  Used for genuinely independent items (a decision card), never to box
  ordinary prose.
- **Inputs:** flat, hairline, no inner shadow.
- **Navigation / TOC:** quiet label type in muted ink; the current item in
  foreground. No pills.
- **Tables:** uppercase tracked labels in muted ink, hairline row rules,
  numeric columns in mono. The table is furniture, not a hero.
- **Chart palette:** the five chart tokens in order; gold only for the
  series the reader must compare against.

### Signature moves

Beyond the tokens, a boardroom document is recognizable by these. Use at
least one; they are what separate it from a plain memo in the same palette.

- **The cover line.** One sentence under the title, set in serif display a
  step above body size, stating the decision or thesis. The document's single
  rhetorical moment; everything after it is evidence.
- **The one figure.** The single number that decides the matter, pulled inline
  at display scale in navy, exactly once. Not a tile row — one figure, in the
  sentence that needs it.
- **Ruled section openers.** Each `h2` opens on a hairline with generous space
  above, so sections read as considered chapters, not a continuous scroll.

## 6. Do's and Don'ts

Do:

- Let one number, one claim, or one verdict be the loudest thing per page.
- Spend whitespace generously around the decision the reader must make.
- Keep metadata labeled and inline at the head of the document.
- Use the full measure (44rem) for prose and let tables breathe wider when
  they need to.

Don't:

- Don't warm the canvas toward cream or beige.
- Don't round corners past 4px anywhere.
- Don't add icons to headings or bullets; the reader is not a child.
- Don't use red for emphasis; red means risk or loss here.
- Don't box prose in cards to make it look designed.
- Don't let serif leak into body text.

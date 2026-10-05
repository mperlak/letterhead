---
name: Atelier
description: Documents a small business sends to its own customers. Warm paper, a soft serif over a friendly sans, one muted cognac accent, the price and the next steps stated plainly.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9780 0.0080 80)"
  foreground: "oklch(0.2500 0.0150 55)"
  card: "oklch(0.9930 0.0040 80)"
  card-foreground: "oklch(0.2500 0.0150 55)"
  popover: "oklch(0.9930 0.0040 80)"
  popover-foreground: "oklch(0.2500 0.0150 55)"
  primary: "oklch(0.5000 0.0800 55)"
  primary-foreground: "oklch(0.9900 0.0040 80)"
  secondary: "oklch(0.9480 0.0120 75)"
  secondary-foreground: "oklch(0.3100 0.0180 55)"
  muted: "oklch(0.9560 0.0100 78)"
  muted-foreground: "oklch(0.4800 0.0200 60)"
  accent: "oklch(0.9380 0.0240 65)"
  accent-foreground: "oklch(0.4000 0.0700 52)"
  destructive: "oklch(0.5200 0.1700 27)"
  destructive-foreground: "oklch(0.9900 0.0040 80)"
  border: "oklch(0.8950 0.0140 72)"
  input: "oklch(0.8950 0.0140 72)"
  ring: "oklch(0.5000 0.0800 55)"
  chart-1: "oklch(0.5000 0.0800 55)"
  chart-2: "oklch(0.6000 0.0600 145)"
  chart-3: "oklch(0.7800 0.0700 82)"
  chart-4: "oklch(0.5600 0.0550 240)"
  chart-5: "oklch(0.6200 0.0150 60)"
  sidebar: "oklch(0.9680 0.0090 78)"
  sidebar-foreground: "oklch(0.2500 0.0150 55)"
  sidebar-primary: "oklch(0.5000 0.0800 55)"
  sidebar-primary-foreground: "oklch(0.9900 0.0040 80)"
  sidebar-accent: "oklch(0.9380 0.0240 65)"
  sidebar-accent-foreground: "oklch(0.4000 0.0700 52)"
  sidebar-border: "oklch(0.8950 0.0140 72)"
  sidebar-ring: "oklch(0.5000 0.0800 55)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2.125rem, 5vw, 2.75rem)"
    fontWeight: 500
    lineHeight: 1.18
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.78125rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "6px"
  md: "9px"
  lg: "12px"
  xl: "14px"

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
    padding: "0.625rem 1.25rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input-text:
    backgroundColor: "{colors.card}"
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

# Atelier

## 1. Overview

> "Written to one person, and it reads that way."

Atelier is the register for documents a small business sends to its own
customers: an interior designer's proposal and project summary, a shop's
offer or order recap, a studio's care guide, a quote for work in someone's
home. The reader is a private person, usually on a phone, deciding whether
to trust the sender and pay. The document has to feel personal and calm,
and leave no doubt about the price, the dates, and what happens next.

Key characteristics:

- Warm paper, deep brown ink, one muted cognac accent.
- A soft serif (Fraunces) for the title and headings over a friendly
  humanist sans (Nunito Sans) for everything the reader has to act on.
- Soft radii (6 to 14px), one gentle shadow for the cards that matter.
- A narrow measure and generous line height: it reads like a letter, not
  a form.
- Rejects: luxury coldness (black pages, gold, spaced capitals),
  sales pressure, and procurement tables the reader has to decode.

## 2. Colors

Primary group: cognac for links, step numbers, and the total in the price
summary. Neutral group: cream paper, a lighter card surface, and warm
browns for text. Accent: a pale tint of the primary for the personal note
and highlighted terms. State: destructive red only for a real warning (a
deadline that voids the offer, a care instruction that prevents damage).
Charts: cognac, sage, sand, dusty blue, taupe.

The style is built to take a brand's color in the primary slot. A shop's
green, a studio's pink or a navy all sit on this paper because every
surface around the primary is a near-neutral warm tint. Keep the primary
the only saturated color on the page, so a brand swap changes one thing.

## 3. Typography

Two families. Fraunces at weight 500 sets the title, section headings, the
opening of the personal note and the price total; its soft shapes carry
the warmth. Nunito Sans sets body text, labels, tables and anything with a
number the reader must check. Body text is 1.0625rem at 1.7 line height,
sized for a phone held at arm's length.

The serif never goes below heading size except in the note's opening line.
Line items, dates and quantities are set in the sans, with the currency
and the tax status written out; the one total in the price summary is the
only figure the serif carries.

## 4. Elevation

Mostly flat. The paper does the work; hairlines separate sections. One soft
shadow is reserved for the card the reader will come back to (the price
summary). Dark mode is an evening room: espresso ground, cream text, the
cognac lifted so it still reads as warm.

## 5. Components

- **Buttons:** 9px radius, cognac fill, one per document at most (the reply
  or booking link).
- **Cards:** lighter than the paper, 14px radius, hairline border; the
  price summary and the personal note, nothing else.
- **Inputs:** card surface, hairline border, cognac focus ring.
- **Navigation / TOC:** usually none; these documents are short. When one
  exists, plain labels in muted brown.
- **Tables:** two columns wherever possible (what, how much), sentence-case
  headers, amounts right-aligned in the sans.
- **Chart palette:** chart-1 through chart-5 in order.

### Signature moves

Use at least one; they are what make the document feel written for one
person rather than printed for a segment.

- **The personal note.** Right under the title, a few sentences addressed
  to the reader by name, set on the accent tint with the first line in the
  serif and the sender's name and role at the end. Only when the source
  names both people; never a generic "Dear customer".
- **The price at a glance.** One card that states what is included, the
  total in the serif, what is paid when, and until when the price holds.
  Labels left, amounts right, one line each, nothing struck through.
- **The next-steps path.** The close is a short numbered sequence (who does
  what, and by when), numbers in cognac on a thin connecting line, ending
  with the moment the reader gets the result.

## 6. Do's and Don'ts

Do:

- Write to "you", and name the sender as a person.
- State every price in full: amount, currency, tax included or not.
- Give dates and durations, not "soon" or "in a few weeks".
- Keep one clear ask, and say what happens the day after a yes.

Don't:

- Don't use urgency tricks: countdowns, "only today", crossed-out prices.
- Don't set body text, prices or dates in the serif.
- Don't add a second saturated color next to the primary.
- Don't use uppercase micro-labels on every line; one label style, used
  sparingly.
- Don't exceed 14px radius or stack cards inside cards.

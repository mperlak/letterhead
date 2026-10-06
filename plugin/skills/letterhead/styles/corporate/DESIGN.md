---
name: Corporate
description: Documents for the internal enterprise reader — familiar blue, slate neutrals, conservative shapes, medium density.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9880 0.0020 248)"
  foreground: "oklch(0.2300 0.0120 255)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.2300 0.0120 255)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.2300 0.0120 255)"
  primary: "oklch(0.4500 0.1300 252)"
  primary-foreground: "oklch(0.9900 0.0020 248)"
  secondary: "oklch(0.9550 0.0060 247)"
  secondary-foreground: "oklch(0.3000 0.0200 253)"
  muted: "oklch(0.9620 0.0050 247)"
  muted-foreground: "oklch(0.4600 0.0180 251)"
  accent: "oklch(0.9350 0.0130 250)"
  accent-foreground: "oklch(0.3600 0.0700 252)"
  destructive: "oklch(0.5100 0.1750 27)"
  destructive-foreground: "oklch(0.9900 0.0030 248)"
  border: "oklch(0.9050 0.0070 249)"
  input: "oklch(0.9050 0.0070 249)"
  ring: "oklch(0.4500 0.1300 252)"
  chart-1: "oklch(0.4500 0.1300 252)"
  chart-2: "oklch(0.6000 0.1000 248)"
  chart-3: "oklch(0.7300 0.0700 245)"
  chart-4: "oklch(0.5500 0.0900 160)"
  chart-5: "oklch(0.5600 0.0250 250)"
  sidebar: "oklch(0.9700 0.0045 248)"
  sidebar-foreground: "oklch(0.2300 0.0120 255)"
  sidebar-primary: "oklch(0.4500 0.1300 252)"
  sidebar-primary-foreground: "oklch(0.9900 0.0020 248)"
  sidebar-accent: "oklch(0.9350 0.0130 250)"
  sidebar-accent-foreground: "oklch(0.3600 0.0700 252)"
  sidebar-border: "oklch(0.9050 0.0070 249)"
  sidebar-ring: "oklch(0.4500 0.1300 252)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(1.875rem, 4vw, 2.375rem)"
    fontWeight: 650
    lineHeight: 1.25
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.4375rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.58
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"

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
    padding: "1.375rem"
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

# Corporate

## 1. Overview

> "It reads like the best-maintained page on the intranet."

Corporate is the register for the internal enterprise reader: managers,
adjacent teams, steering groups. Familiarity is the feature. The style uses
a trustworthy mid-blue, slate neutrals, conservative shapes, and medium
density, so the document feels native to the reader's daily tooling and
nothing distracts from the content.

Key characteristics:

- One institutional blue for links, emphasis, and the current item.
- Slate-tinted neutrals; white cards on a near-white canvas.
- Conservative radii (4 to 10px), quiet shadows.
- Medium density; comfortable for long policy-and-plan reading.
- Rejects: startup flash, editorial flourish, dashboard chrome.

## 2. Colors

Primary group: the blue marks navigation, links, and key values. Neutral
group: a narrow slate ramp for canvas, cards, rules. State: destructive red
for genuine risk only; green appears only via chart-4 when data needs it.
Charts: blue-led ladder plus one green and one gray.

The blue stays in the 245–255 hue band; teal
and violet drift read as somebody else's brand.

## 3. Typography

One family throughout: Source Sans 3. Size and weight do all the work:
semibold headings, regular body, small tracked labels. Mono is for
identifiers and table figures only. Nothing is set for display effect; the
largest type on the page stays below 2.4rem.

Use no second family and no more than four weights of this one.

## 4. Elevation

Flat with hairlines; the two shadows exist for sticky chrome and modals in
web contexts. Dark mode separates with lightness steps.

## 5. Components

- **Buttons:** rectangular, 6px corners, blue fill for the primary action.
- **Cards:** white, hairline border, used for genuinely separate items.
- **Inputs:** flat, hairline, blue focus ring.
- **Navigation / TOC:** quiet labels, current item blue.
- **Tables:** the workhorse. Uppercase tracked headers, hairline rows,
  numeric columns right-aligned in mono.
- **Chart palette:** chart-1 through chart-5 in order.

### Signature moves

Use at least one; they carry the familiar-intranet authority beyond the
palette.

- **The executive summary box.** A bordered, muted-fill callout directly under
  the title carrying the two-to-three-sentence takeaway for the reader who
  reads nothing else.
- **The recommendation ledger.** Recommendations as a numbered list with
  R1 / R2 badges in the primary blue, each tied to the finding it follows from.
- **Blue-ruled sections.** Section openers carry a thin blue rule — the
  predictable rhythm the reader already trusts from their other documents.

## 6. Do's and Don'ts

Do:

- Keep the rhythm even; predictability is respect for the reader's time.
- Use labeled metadata rows exactly as the reader's other documents do.
- Let tables be tables; no decoration inside cells.

Don't:

- Don't exceed 10px radius anywhere.
- Don't introduce accent hues beyond the blue and the state colors.
- Don't use display-scale type; this register has no hero moments.
- Don't box prose in cards to fake structure.

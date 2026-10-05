---
name: Gazette
description: The newsprint wildcard — serif body, heavy headlines, hairline rules, one vermilion accent, square corners. Dark mode is the night edition.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9760 0.0020 90)"
  foreground: "oklch(0.1900 0.0030 80)"
  card: "oklch(0.9880 0.0015 90)"
  card-foreground: "oklch(0.1900 0.0030 80)"
  popover: "oklch(0.9880 0.0015 90)"
  popover-foreground: "oklch(0.1900 0.0030 80)"
  primary: "oklch(0.5000 0.1650 32)"
  primary-foreground: "oklch(0.9900 0.0015 90)"
  secondary: "oklch(0.9420 0.0035 88)"
  secondary-foreground: "oklch(0.2600 0.0040 82)"
  muted: "oklch(0.9520 0.0030 88)"
  muted-foreground: "oklch(0.4350 0.0050 83)"
  accent: "oklch(0.9300 0.0100 45)"
  accent-foreground: "oklch(0.4100 0.1200 33)"
  destructive: "oklch(0.5000 0.1650 32)"
  destructive-foreground: "oklch(0.9900 0.0015 90)"
  border: "oklch(0.8300 0.0045 86)"
  input: "oklch(0.8300 0.0045 86)"
  ring: "oklch(0.5000 0.1650 32)"
  chart-1: "oklch(0.5000 0.1650 32)"
  chart-2: "oklch(0.3300 0.0050 82)"
  chart-3: "oklch(0.5500 0.0050 84)"
  chart-4: "oklch(0.4400 0.0500 250)"
  chart-5: "oklch(0.7000 0.0040 86)"
  sidebar: "oklch(0.9600 0.0025 89)"
  sidebar-foreground: "oklch(0.1900 0.0030 80)"
  sidebar-primary: "oklch(0.5000 0.1650 32)"
  sidebar-primary-foreground: "oklch(0.9900 0.0015 90)"
  sidebar-accent: "oklch(0.9300 0.0100 45)"
  sidebar-accent-foreground: "oklch(0.4100 0.1200 33)"
  sidebar-border: "oklch(0.8300 0.0045 86)"
  sidebar-ring: "oklch(0.5000 0.1650 32)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2.25rem, 5.5vw, 3.125rem)"
    fontWeight: 800
    lineHeight: 1.08
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5625rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.71875rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.84375rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "0px"
  md: "0px"
  lg: "2px"
  xl: "2px"

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

# Gazette

## 1. Overview

> "Set like news, because somebody should read it today."

Gazette is the catalog's aesthetic wildcard: a newsprint register for
documents that want editorial authority: briefings, digests, analyses,
announcements. It is the only style here that runs a serif body. Black
headline weights, hairline and double-rule structure, one vermilion
accent, square corners. Dark mode is the night edition.

Key characteristics:

- Serif body (Charter) at newspaper measure and leading.
- Headlines in heavy serif; kickers and labels in tracked uppercase sans.
- Rules do the layout: hairlines between items, double rules between
  sections.
- One vermilion accent for the lead item and links.
- Rejects: card-based layout, soft shadows, rounded anything.

## 2. Colors

Primary group: vermilion for the lead, links, and pull-quote marks.
Neutral group: warm-black ink ladder on paper white. State: the vermilion
doubles as the alert color; this register has no green. Charts: vermilion
plus ink shades, one slate blue for comparison.

Exactly one item per document gets the vermilion
lead treatment.

## 3. Typography

Charter sets body text and headlines; Archivo sets kickers, bylines and
labels in tracked uppercase. Headline sizes step up in large jumps, which is
what gives the style its newspaper voice, while body text stays at 1.0625rem
with newspaper line spacing. Mono is for table figures only.

Open every section with a small uppercase sans kicker above the headline.
This is the style's signature move.

## 4. Elevation

None. Rules, not shadows: 1px hairlines between items, 3px double rules
between major sections, a heavy rule under the masthead. Corners square.

## 5. Components

- **Buttons:** rare; rectangular, sharp, ink-filled.
- **Containers:** rule-delimited segments, never floating cards.
- **Inputs:** underline-only.
- **Navigation / TOC:** an index column: item, page-style reference.
- **Tables:** almanac-style: tight, ruled, numbers in mono.
- **Chart palette:** chart-1 through chart-5; charts styled like print
  graphics, no gridline noise.

### Signature moves

Use at least one; they are what make the page read as news rather than a
serif memo.

- **The masthead.** The document title is set like a newspaper's name, centered
  under a heavy rule, with a dateline (edition · date · reference) below it.
- **The kicker.** Every section opens with a small uppercase sans kicker above
  the headline — the register's signature.
- **The front-page lead.** Exactly one item gets the vermilion lead treatment
  and the largest headline; double rules separate the major sections.

## 6. Do's and Don'ts

Do:

- Open with a masthead: document title as the paper's name, date and
  edition as the dateline.
- Write real headlines: specific, present tense, no clickbait.
- Use column rules if the content genuinely reads in columns on desktop.

Don't:

- Don't round corners or add shadows.
- Don't use the serif for labels or the sans for body.
- Don't spend vermilion twice.
- Don't fake column layout on mobile; it stacks to one clean column.

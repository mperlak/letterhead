---
name: Consulting
description: The client deliverable — charcoal on true-neutral paper, serif display, oxblood accent, numbered-section discipline.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9800 0.0018 80)"
  foreground: "oklch(0.2350 0.0050 70)"
  card: "oklch(0.9930 0.0012 80)"
  card-foreground: "oklch(0.2350 0.0050 70)"
  popover: "oklch(0.9930 0.0012 80)"
  popover-foreground: "oklch(0.2350 0.0050 70)"
  primary: "oklch(0.4050 0.1100 22)"
  primary-foreground: "oklch(0.9880 0.0015 80)"
  secondary: "oklch(0.9480 0.0035 78)"
  secondary-foreground: "oklch(0.3000 0.0060 72)"
  muted: "oklch(0.9560 0.0030 78)"
  muted-foreground: "oklch(0.4550 0.0070 73)"
  accent: "oklch(0.9350 0.0090 40)"
  accent-foreground: "oklch(0.3600 0.0750 24)"
  destructive: "oklch(0.5100 0.1700 28)"
  destructive-foreground: "oklch(0.9880 0.0015 80)"
  border: "oklch(0.8980 0.0040 77)"
  input: "oklch(0.8980 0.0040 77)"
  ring: "oklch(0.4050 0.1100 22)"
  chart-1: "oklch(0.4050 0.1100 22)"
  chart-2: "oklch(0.5600 0.0850 28)"
  chart-3: "oklch(0.7000 0.0600 35)"
  chart-4: "oklch(0.4400 0.0450 250)"
  chart-5: "oklch(0.5500 0.0050 75)"
  sidebar: "oklch(0.9650 0.0025 79)"
  sidebar-foreground: "oklch(0.2350 0.0050 70)"
  sidebar-primary: "oklch(0.4050 0.1100 22)"
  sidebar-primary-foreground: "oklch(0.9880 0.0015 80)"
  sidebar-accent: "oklch(0.9350 0.0090 40)"
  sidebar-accent-foreground: "oklch(0.3600 0.0750 24)"
  sidebar-border: "oklch(0.8980 0.0040 77)"
  sidebar-ring: "oklch(0.4050 0.1100 22)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2rem, 4.5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.22
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5rem"
    fontWeight: 600
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
    lineHeight: 1.64
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
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"

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

# Consulting

## 1. Overview

> "The deliverable that justifies the invoice before anyone reads page two."

Consulting is the register for client deliverables: assessments,
recommendations, engagement documents. Quietly expensive: charcoal ink on
true-neutral paper, a serif display voice (Charis SIL, the open-licensed
Charter), one oxblood accent, and numbered-section discipline throughout.
The authority is structural, not decorative.

Key characteristics:

- True neutral paper (not cream, not gray-blue); charcoal ink.
- Serif display and headings; humanist sans body and labels.
- Oxblood accent used sparingly: numbers of sections, links, key verdicts.
- Numbered sections, disciplined hierarchy, generous margins.
- Rejects: corporate blue, startup scale-play, any visible template-ness.

## 2. Colors

Primary group: oxblood for section numbers, links, and verdict emphasis.
Neutral group: a warm-neutral ramp so close to gray it reads as paper.
State: destructive red distinct from the oxblood. The pale accent tint
(in a brand, its second color) fills the executive summary panel and
nothing else. Charts: oxblood ladder plus one slate blue.

The accent appears at most once per viewport;
its scarcity is its authority.

## 3. Typography

Two families. Charis SIL, the open-licensed expansion of Bitstream
Charter, sets the title and section headings; Source Sans 3 sets body text
and labels. Body text is 1.0625rem with generous line spacing, sized for
reading a long document start to finish.
Section numbers belong to the heading and take the accent color.

Number the top-level sections, and set the numbers as part of the heading
design rather than as a plain prefix.

## 4. Elevation

Flat. Hairlines and whitespace only; the shadow tokens exist for web
chrome and stay near-invisible. Dark mode is a reading-lamp dark: warm
charcoal, lifted accent.

## 5. Components

- **Buttons:** rare in documents; rectangular, 4px, oxblood fill.
- **Cards:** hairline boxes for verdicts and callouts only.
- **Inputs:** flat, hairline.
- **Navigation / TOC:** numbered list matching the section spine.
- **Tables:** ruled like a book's appendix: thin rules, serif-free cells,
  numbers right-aligned.
- **Chart palette:** chart-1 through chart-5 in order.

### Signature moves

Use at least one; they carry the quiet authority beyond the palette.

- **The numbered spine.** Top-level sections carry oxblood numbers (01, 02, …)
  mirrored in a contents block; the spine is visible from the first screen.
- **The verdict line.** Each recommendation or judgment gets one
  oxblood-accented sentence, standing apart from its supporting prose.
- **The signature close.** The document ends with a labeled prepared-by / date
  block, set like a letter's sign-off.

## 6. Do's and Don'ts

Do:

- Number the sections and keep the spine visible in the TOC.
- Give verdicts and recommendations the accent treatment, once each.
- Keep the paper true neutral; warmth beyond C 0.004 reads as cream.

Don't:

- Don't use the serif for body text; it is a display voice here.
- Don't use blue for links; links are oxblood.
- Don't decorate; if a page looks plain, the content is not done.
- Don't exceed 8px radius anywhere.

---
name: Markloop
description: Violet-anchored, paper-calm product brand — Manrope voice, Newsreader for editorial moments, JetBrains Mono for the working parts.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file.
# Taught 2026-07-12 from the product app's tokens (app.markloop.io), with
# the live marketing site as a secondary source.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.2225 0.0155 291)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.2225 0.0155 291)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.2225 0.0155 291)"
  primary: "oklch(0.5032 0.2150 292)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.9663 0.0067 295)"
  secondary-foreground: "oklch(0.3513 0.0242 288)"
  muted: "oklch(0.9837 0.0041 301)"
  muted-foreground: "oklch(0.5339 0.0233 289)"
  accent: "oklch(0.9513 0.0206 301)"
  accent-foreground: "oklch(0.4476 0.1996 290)"
  destructive: "oklch(0.5735 0.1529 37)"
  destructive-foreground: "oklch(1 0 0)"
  border: "oklch(0.9395 0.0081 294)"
  input: "oklch(0.9280 0.0108 292)"
  ring: "oklch(0.5032 0.2150 292)"
  chart-1: "oklch(0.8071 0.0904 300)"
  chart-2: "oklch(0.6398 0.1911 297)"
  chart-3: "oklch(0.5032 0.2150 292)"
  chart-4: "oklch(0.4076 0.1937 290)"
  chart-5: "oklch(0.2751 0.1074 291)"
  sidebar: "oklch(0.9837 0.0041 301)"
  sidebar-foreground: "oklch(0.5339 0.0233 289)"
  sidebar-primary: "oklch(0.5032 0.2150 292)"
  sidebar-primary-foreground: "oklch(1 0 0)"
  sidebar-accent: "oklch(0.9513 0.0206 301)"
  sidebar-accent-foreground: "oklch(0.4476 0.1996 290)"
  sidebar-border: "oklch(0.9450 0.0070 295)"
  sidebar-ring: "oklch(0.5032 0.2150 292)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(1.875rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.2
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.4375rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.8438rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"

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

# Markloop

## 1. Overview

> "A calm reading surface where one violet voice points at what matters."

Markloop is a web app for reviewing agent-made HTML documents, and its
brand behaves like the product: the document is the hero, the chrome stays
quiet, and a single confident violet marks interaction and identity. White
canvas, soft near-violet neutrals, generous card radius, and a friendly
but technical typographic voice (Manrope). Newsreader serif exists for
editorial moments; JetBrains Mono for anything that is code, an ID, or a
number at work.

Key characteristics:

- One chromatic identity: violet `#6d3bd1`, used with intent, never diluted
  across cross-hue gradients.
- Near-violet tinted neutrals; surfaces feel warm-clean, not sterile gray.
- Soft radii (10 to 16px); the product feels approachable, not corporate.
- Comment-pin energy: small, precise markers, not big decorative shapes.
- Rejects: AI-startup gradient stacks, dashboard chrome, hype visuals.

Known variant: the marketing landing currently runs an indigo-led palette
(`#3135c9`, Inter). This profile follows the product app; confirm with the
owner before using the indigo variant anywhere.

## 2. Colors

Primary: the violet family (`primary`, `accent-foreground` for tinted
surfaces). Neutral: whites and near-violet grays for canvas, cards, and
hairlines. State: the product's document-status vocabulary is part of the
brand (`--status-closed` green, `--status-progress` amber, `--status-open`
rust); use it whenever a document reports thread or task states.
Charts: a five-step violet lightness ladder.

Violet is the only brand voice on a page. If a
second hue appears, it is a state color doing state work.

Grays lean violet (hue 285–301), never blue or
green.

## 3. Typography

Manrope everywhere words are read; bold weights (600–700) for headings,
regular for body. Newsreader appears only as a deliberate editorial accent
(a pull quote, a cover line), never for running body text. JetBrains Mono
for code, identifiers, and tabular numbers. Hierarchy comes from weight and
size inside one family, which keeps documents feeling like the product UI.

Manrope leads every stack; a generic sans in
front of it is a brand violation.

## 4. Elevation

Soft and sparing. Hairline borders carry most structure; the card shadow is
a long, low, violet-tinted plume used for genuinely floating surfaces.
Dark mode separates by lightness steps and drops most shadows.

## 5. Components

- **Buttons:** violet fill, white label, 10px radius, subtle violet-tinted
  shadow on the primary action only.
- **Cards:** white on white with hairline plus soft shadow, 14px radius.
- **Inputs:** hairline, violet focus ring.
- **Navigation / TOC:** muted ink, current item violet.
- **Tables:** quiet headers in label type, hairline rows, mono for
  numbers and IDs; status words use the status tokens with their tinted
  backgrounds.
- **Chart palette:** the violet ladder, chart-1 (lightest) through chart-5
  (darkest).

## 6. Do's and Don'ts

Do:

- Let the document content lead; brand shows in type, violet, and rhythm.
- Use the status vocabulary for anything with open/addressed/answered
  states.
- Keep metadata labeled and inline, like the product's document header.
- Write short, concrete, builder-to-builder copy.

Don't:

- Don't pair the violet with cyan, pink, or any second display hue.
- Don't use Newsreader for body text or UI labels.
- Don't ship gradient text or gradient buttons.
- Don't lead with mechanism talk (MCP, sandbox) in reader-facing documents;
  lead with what the reader gets.
- Don't use the landing's indigo variant without checking with the owner.

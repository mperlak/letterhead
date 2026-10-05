---
name: Mroomy
description: Warm, rounded, parent-friendly — raspberry pink over warm paper, Nunito's soft geometry, pastel sky as the supporting breeze.

# The colors below are the light theme. The dark theme in tokens.css next
# to this file is derived from it (the site itself is light-only).
# Taught 2026-07-12 from the live site (mroomy.com).
colors:
  background: "oklch(0.9694 0.0059 60)"
  foreground: "oklch(0.2520 0 0)"
  card: "oklch(0.9997 0.0013 106)"
  card-foreground: "oklch(0.2520 0 0)"
  popover: "oklch(0.9997 0.0013 106)"
  popover-foreground: "oklch(0.2520 0 0)"
  primary: "oklch(0.5946 0.2100 359)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.9300 0.0170 55)"
  secondary-foreground: "oklch(0.3558 0.0017 106)"
  muted: "oklch(0.9500 0.0100 58)"
  muted-foreground: "oklch(0.4700 0.0060 80)"
  accent: "oklch(0.9440 0.0270 359)"
  accent-foreground: "oklch(0.5000 0.1900 359)"
  destructive: "oklch(0.5400 0.1900 28)"
  destructive-foreground: "oklch(1 0 0)"
  border: "oklch(0.8910 0.0198 55)"
  input: "oklch(0.8910 0.0198 55)"
  ring: "oklch(0.5946 0.2100 359)"
  chart-1: "oklch(0.5946 0.2100 359)"
  chart-2: "oklch(0.8211 0.0655 240)"
  chart-3: "oklch(0.6487 0.1127 224)"
  chart-4: "oklch(0.7600 0.1200 75)"
  chart-5: "oklch(0.5417 0 0)"
  sidebar: "oklch(0.9560 0.0090 58)"
  sidebar-foreground: "oklch(0.3558 0.0017 106)"
  sidebar-primary: "oklch(0.5946 0.2100 359)"
  sidebar-primary-foreground: "oklch(1 0 0)"
  sidebar-accent: "oklch(0.9440 0.0270 359)"
  sidebar-accent-foreground: "oklch(0.5000 0.1900 359)"
  sidebar-border: "oklch(0.9000 0.0180 55)"
  sidebar-ring: "oklch(0.5946 0.2100 359)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2rem, 5vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.2
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "var(--font-display)"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.3
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
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"

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
    rounded: "{rounded.xl}"
    padding: "0.625rem 1.5rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 1.5rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input-text:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.625rem 0.875rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
  nav-link-hover:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
---

# Mroomy

## 1. Overview

> "A children's room, tidied by a professional: playful colors, grown-up
> order."

Mroomy designs kids' and teens' rooms, fully online, for parents who want
the result without the stress. The brand is warm and rounded: raspberry
pink energy on warm paper, Nunito's soft geometry in headings, pastel sky
blue as the calm counterweight. Documents in this brand should feel like a
well-organized moodboard: friendly on the surface, precise underneath,
because the reader is a paying parent making real decisions about budget
and timing.

Key characteristics:

- Raspberry `#e20c7b` leads; hot pink `#f00069` is the action color.
- Warm paper surfaces (cream, beige hairlines), white cards.
- Big radii (14 to 24px) and soft shadows; nothing sharp-edged.
- Pastel sky `#9ecbeb` supports, never competes.
- Rejects: cold luxury-studio minimalism, corporate gray, technical
  jargon.

## 2. Colors

Primary group: raspberry for identity and emphasis, hot pink strictly for
calls to action, pink-tinted `accent` surfaces for highlighted blocks.
Neutral group: warm paper background, white cards, beige hairlines, soft
warm grays for secondary text. State: destructive is a warm red, distinct
from the brand pinks. Charts: raspberry, sky, teal, amber, neutral.

Raspberry says "this is Mroomy"; hot pink says
"act here". They never swap jobs, and they never sit side by side.

Backgrounds stay warm (hue 53–60). Cool grays are
off-brand.

## 3. Typography

Nunito (weights 600–800) for display, headings, and buttons; its rounded
terminals are half the brand's warmth. Nunito Sans for body text. Since
documents stay self-contained, both stacks fall back to system rounded and
humanist faces; the intended webfonts are Google Fonts (OFL), safe to load
in web contexts. Mono barely exists in this brand; use it only for order
numbers or measurements in tables.

Headings are Nunito extra-bold, sentence case,
never uppercase. Shouting is off-brand.

## 4. Elevation

Soft shadows are welcome here, in moderation: cards can float gently over
the paper. Hairlines are warm beige, not gray. Dark mode (derived, not
captured from the site) keeps the warmth: charcoal with a warm cast, pinks
lifted for contrast.

## 5. Components

- **Buttons:** pill-shaped (24px radius), hot pink for the primary action,
  Nunito semibold labels.
- **Cards:** white, 18px radius, soft shadow, generous padding.
- **Inputs:** white on paper, rounded, raspberry focus ring.
- **Navigation / TOC:** warm gray labels, current item raspberry.
- **Tables:** friendly, not austere: warm hairlines, sentence-case headers,
  prices right-aligned. A price table is a common object in this brand's
  documents; make it comfortable.
- **Chart palette:** raspberry, sky, teal, amber, neutral, in that order.

## 6. Do's and Don'ts

Do:

- Speak to the parent, benefit first ("save your time", "stress-free").
- Use white cards on warm paper for offers, packages, and room sections.
- Keep prices, dates, and scope in tidy tables; parents decide on these.
- Let sky blue cool down pages that get too pink.

Don't:

- Don't use cold grays or blue-tinted neutrals anywhere.
- Don't set headings in uppercase or in a serif.
- Don't use hot pink for anything that is not an action.
- Don't sharpen corners below 10px; the brand is round.
- Don't write in corporate or technical register; a parent is reading.

---
name: Startup
description: Documents that sell momentum — white canvas, one confident emerald, big tight display type, energy from scale, not decoration.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.1900 0.0060 165)"
  card: "oklch(0.9820 0.0030 160)"
  card-foreground: "oklch(0.1900 0.0060 165)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.1900 0.0060 165)"
  primary: "oklch(0.5200 0.1280 155)"
  primary-foreground: "oklch(0.9950 0.0020 160)"
  secondary: "oklch(0.9600 0.0050 160)"
  secondary-foreground: "oklch(0.2800 0.0120 162)"
  muted: "oklch(0.9700 0.0040 160)"
  muted-foreground: "oklch(0.4700 0.0140 163)"
  accent: "oklch(0.9450 0.0250 158)"
  accent-foreground: "oklch(0.3700 0.0800 156)"
  destructive: "oklch(0.5300 0.1850 28)"
  destructive-foreground: "oklch(0.9950 0.0020 160)"
  border: "oklch(0.9150 0.0060 161)"
  input: "oklch(0.9150 0.0060 161)"
  ring: "oklch(0.5200 0.1280 155)"
  chart-1: "oklch(0.5200 0.1280 155)"
  chart-2: "oklch(0.6800 0.1100 152)"
  chart-3: "oklch(0.8100 0.0800 150)"
  chart-4: "oklch(0.4600 0.0900 240)"
  chart-5: "oklch(0.5800 0.0180 162)"
  sidebar: "oklch(0.9750 0.0035 160)"
  sidebar-foreground: "oklch(0.1900 0.0060 165)"
  sidebar-primary: "oklch(0.5200 0.1280 155)"
  sidebar-primary-foreground: "oklch(0.9950 0.0020 160)"
  sidebar-accent: "oklch(0.9450 0.0250 158)"
  sidebar-accent-foreground: "oklch(0.3700 0.0800 156)"
  sidebar-border: "oklch(0.9150 0.0060 161)"
  sidebar-ring: "oklch(0.5200 0.1280 155)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2.25rem, 5.5vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.12
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5625rem"
    fontWeight: 650
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
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
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"

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

# Startup

## 1. Overview

> "Confident enough to use whitespace as the pitch."

Startup is the register for documents that sell momentum to investors,
partners, and early customers. Energy comes from scale contrast and rhythm:
big bold display type, generous sections, one confident emerald on
white. No gradients, no decoration; the confidence is typographic.

Key characteristics:

- White canvas, near-black ink, one emerald accent.
- Display type is large and tight (Space Grotesk); body stays calm (Inter).
- Roomy radii (12 to 20px) and soft, low shadows.
- Sections breathe; one idea per screen.
- Rejects: the purple-cyan AI stack, metric-hero clichés, icon grids.

## 2. Colors

Primary group: emerald for emphasis, links, and the one number that
matters per screen. Neutral group: whites and green-tinted grays. State:
destructive red only for real risk. Charts: emerald ladder plus one blue
for comparison series.

At most one emerald-emphasized value per screen;
two competing highlights cancel each other.

## 3. Typography

Space Grotesk sets the title and headings with tight negative tracking
(--tracking-display); Inter sets body text and labels. The jump in size is
the style's voice: the title can reach 3.25rem while body text stays at
1rem. Mono is for code and metric tables only.

Give display size only to claims the source backs up. A claim without
support is set at body size.

## 4. Elevation

Soft and minimal: cards can float slightly, everything else is flat. Dark
mode is a first-class surface with lightness-step separation.

## 5. Components

- **Buttons:** 12px radius, emerald fill for the single call to action.
- **Cards:** soft-shadowed, roomy padding, for genuinely parallel items.
- **Inputs:** flat, hairline, emerald ring.
- **Navigation / TOC:** minimal, labels only.
- **Tables:** clean and airy; used when data is real, never as texture.
- **Chart palette:** chart-1 through chart-5 in order.

### Signature moves

Use at least one; they carry the momentum through composition, not decoration.

- **The display-scale opener.** The thesis in the largest, tightest type on
  the page — one claim, before any supporting prose.
- **The closing ask panel.** The decision requested sits in a soft-shadowed
  card at the end, unmissable, echoing the opener.
- **The one-number pull.** Per section, at most one emerald-emphasized figure,
  sized up inline in the sentence that earns it.
- **The roadmap.** Steps run down a thin line with a ring on each stop, the
  time above the step, so a plan reads as momentum rather than a table.

## 6. Do's and Don'ts

Do:

- Lead each section with its strongest claim in display type.
- Keep body measure narrow (42rem) and calm.
- Let dark mode carry the same energy; test both.

Don't:

- Don't pair the emerald with a second display hue.
- Don't use metric-hero blocks without sourced numbers.
- Don't compress line-height on body text to look dense.
- Don't add icons to make sections feel designed.

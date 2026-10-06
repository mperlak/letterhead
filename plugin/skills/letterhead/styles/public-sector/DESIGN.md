---
name: Public sector
description: Documents any citizen must be able to read — maximum legibility, institutional blue, large type, no decoration, no motion.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.1800 0.0080 250)"
  card: "oklch(0.9740 0.0040 247)"
  card-foreground: "oklch(0.1800 0.0080 250)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.1800 0.0080 250)"
  primary: "oklch(0.4150 0.1080 248)"
  primary-foreground: "oklch(0.9950 0.0015 247)"
  secondary: "oklch(0.9550 0.0055 246)"
  secondary-foreground: "oklch(0.2500 0.0140 250)"
  muted: "oklch(0.9640 0.0045 246)"
  muted-foreground: "oklch(0.4050 0.0170 249)"
  accent: "oklch(0.9300 0.0120 247)"
  accent-foreground: "oklch(0.3200 0.0650 249)"
  destructive: "oklch(0.4900 0.1800 27)"
  destructive-foreground: "oklch(0.9950 0.0015 247)"
  border: "oklch(0.8600 0.0090 247)"
  input: "oklch(0.8600 0.0090 247)"
  ring: "oklch(0.4150 0.1080 248)"
  chart-1: "oklch(0.4150 0.1080 248)"
  chart-2: "oklch(0.5600 0.0950 246)"
  chart-3: "oklch(0.7000 0.0700 244)"
  chart-4: "oklch(0.4700 0.0900 160)"
  chart-5: "oklch(0.4500 0.0200 249)"
  sidebar: "oklch(0.9680 0.0045 246)"
  sidebar-foreground: "oklch(0.1800 0.0080 250)"
  sidebar-primary: "oklch(0.4150 0.1080 248)"
  sidebar-primary-foreground: "oklch(0.9950 0.0015 247)"
  sidebar-accent: "oklch(0.9300 0.0120 247)"
  sidebar-accent-foreground: "oklch(0.3200 0.0650 249)"
  sidebar-border: "oklch(0.8600 0.0090 247)"
  sidebar-ring: "oklch(0.4150 0.1080 248)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(1.875rem, 4vw, 2.375rem)"
    fontWeight: 700
    lineHeight: 1.3
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5rem"
    fontWeight: 650
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
    lineHeight: 1.65
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.9375rem"
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

# Public sector

## 1. Overview

> "If one reader in a hundred struggles, the document has failed."

Public sector is the register for documents any citizen, official, or
committee member must be able to read: notices, procedures, assessments,
tender documents. Legibility outranks every aesthetic preference: strong
ink on white, large body type, wide leading, one institutional blue,
underline-friendly links, no decoration.

Key characteristics:

- Near-black ink on pure white; AA minimum everywhere, AAA where practical.
- Large body (1.0625rem) with 1.65 leading; nothing under 0.8125rem.
- One institutional blue for links and wayfinding.
- Square shapes, visible borders, forms-adjacent tables.
- Rejects: decoration of any kind, low-contrast gray text, motion.

## 2. Colors

Primary group: the institutional blue, used for links and the current
item. Neutral group: blacks and grays that all clear AA on white. State:
destructive red for warnings that concern the reader's obligations.
Charts: blue-led with one green, all AA against white.

No text token below 4.5:1 against its
surface, including muted labels; verify, don't assume.

## 3. Typography

Public Sans throughout, set large. Hierarchy comes from size and weight,
never from color alone. Labels stay readable, at 0.8125rem or more. Mono is
for reference numbers only.

No text goes below the equivalent of 13px anywhere, footers and captions
included.

## 4. Elevation

None. Borders separate; shadows are for web chrome only. Motion is
effectively disabled (fast token at 0ms) because unexpected movement is an
accessibility hazard.

## 5. Components

- **Buttons:** rectangular, 3px, blue fill, generous hit area.
- **Cards:** bordered boxes used for genuinely standalone notices.
- **Inputs:** high-contrast borders, visible focus ring.
- **Navigation / TOC:** a plain numbered list.
- **Tables:** ruled and explicit: visible borders, header row filled with
  the muted surface, no zebra-striping subtlety games.
- **Chart palette:** chart-1 through chart-5; every series must also be
  distinguishable by label, not color alone.

### Signature moves

Use at least one; each also serves legibility, which is the register's first
duty.

- **The verdict box.** A heavy-bordered box near the title stating standing and
  counts in plain language, so no reader has to assemble the verdict
  themselves.
- **Explicit-border tables.** Every table has visible borders and a
  muted-filled header row; nothing relies on subtle striping.
- **Plain-language callouts.** Bordered boxes flag the actions the reader must
  take, in the shortest sentences the content allows.

## 6. Do's and Don'ts

Do:

- Use explicit labels for everything; assume a reader in a hurry, on a
  phone, in bad light.
- Keep sentences and sections short; plain language is part of the style.
- Underline links in running text.

Don't:

- Don't drop text contrast for elegance.
- Don't use color as the only carrier of meaning.
- Don't animate anything.
- Don't use italic for more than a phrase; long italic runs are hard to
  read for many readers.

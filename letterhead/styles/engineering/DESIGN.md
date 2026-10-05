---
name: Engineering
description: Documents for technical teams — denser rhythm, mono in working roles, refined tables, explicit ok/warn/blocked states, dark theme as a first-class citizen.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9850 0.0035 220)"
  foreground: "oklch(0.2100 0.0140 232)"
  card: "oklch(0.9700 0.0045 220)"
  card-foreground: "oklch(0.2100 0.0140 232)"
  popover: "oklch(0.9930 0.0020 220)"
  popover-foreground: "oklch(0.2100 0.0140 232)"
  primary: "oklch(0.4600 0.0780 212)"
  primary-foreground: "oklch(0.9880 0.0030 220)"
  secondary: "oklch(0.9450 0.0060 221)"
  secondary-foreground: "oklch(0.2700 0.0200 230)"
  muted: "oklch(0.9520 0.0055 221)"
  muted-foreground: "oklch(0.4400 0.0180 228)"
  accent: "oklch(0.9250 0.0140 215)"
  accent-foreground: "oklch(0.2500 0.0300 225)"
  destructive: "oklch(0.5000 0.1800 26)"
  destructive-foreground: "oklch(0.9900 0.0030 220)"
  border: "oklch(0.8950 0.0080 222)"
  input: "oklch(0.8950 0.0080 222)"
  ring: "oklch(0.4600 0.0780 212)"
  chart-1: "oklch(0.4600 0.0780 212)"
  chart-2: "oklch(0.5800 0.1000 165)"
  chart-3: "oklch(0.6000 0.1100 80)"
  chart-4: "oklch(0.4500 0.0700 260)"
  chart-5: "oklch(0.6400 0.0350 225)"
  sidebar: "oklch(0.9650 0.0045 220)"
  sidebar-foreground: "oklch(0.2100 0.0140 232)"
  sidebar-primary: "oklch(0.4600 0.0780 212)"
  sidebar-primary-foreground: "oklch(0.9880 0.0030 220)"
  sidebar-accent: "oklch(0.9250 0.0140 215)"
  sidebar-accent-foreground: "oklch(0.2500 0.0300 225)"
  sidebar-border: "oklch(0.8950 0.0080 222)"
  sidebar-ring: "oklch(0.4600 0.0780 212)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)"
    fontWeight: 650
    lineHeight: 1.25
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "var(--font-mono)"
    fontSize: "0.71875rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55

rounded:
  sm: "3px"
  md: "5px"
  lg: "7px"
  xl: "10px"

spacing:
  xs: "0.25rem"
  sm: "0.4375rem"
  md: "0.875rem"
  lg: "1.3125rem"
  xl: "1.75rem"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.4375rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.4375rem 1rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1.125rem"
  input-text:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.4375rem 0.625rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
  nav-link-hover:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
---

# Engineering

## 1. Overview

> "The document reads like a well-kept runbook: dense, labeled, nothing
> decorative, nothing missing."

Engineering is the register for documents whose readers do the work:
integration specs, API references, go-live checklists, incident writeups.
The reader scans for the row that concerns them, so information density per
screen wins over ceremony. Mono type is not decoration here; it has working
roles (labels, identifiers, values, code) and appears nowhere else. Dark is
a first-class theme because half the audience reads in it by default.

Key characteristics:

- Slate-cool neutrals; steel-teal primary; state colors with real meaning.
- Mono for labels, IDs, numbers-in-tables, and code. Sans for everything
  read as sentences.
- Denser vertical rhythm than a prose register; sections earn their space.
- Tables are the flagship component and get the most care.
- Rejects: dashboard cosplay (fake KPIs), icon chrome, oversized hero type.

## 2. Colors

Primary group: `primary` (steel teal) marks links, focus, and the current
item; it is a wayfinding color, not an emphasis color. Neutral group: a
narrow slate ramp for canvas, cards, and rules. State group is the
register's real vocabulary: `--status-ok`, `--status-warn`,
`--status-blocked` (plus `--status-neutral`) color state words and state
dots, never whole rows. Chart group: teal, green, amber, indigo, gray, in
that order.

A state color appears only next to a state the
source actually asserts. Nothing is tinted green to look healthy.

Never fill a table row or card with a state color;
the mark is the word or the dot, background stays canvas.

## 3. Typography

IBM Plex Sans sets running text and headings; IBM Plex Mono sets the
functional parts. Labels (table headers, metadata keys, state words) are
small tracked mono, which gives pages the feel of an instrument panel.
Headings stay small: the largest type on the page is 2.25rem at most,
because the reader opened the document to find a specific row, not to look
at a title.

Use mono only for labels, identifiers, values and code. Never set a full
sentence in mono.

## 4. Elevation

Effectively flat. Hairlines and background steps (`card`, `muted`) do the
separation. The two shadows exist for sticky chrome on mobile and stay
subtle in both themes. Dark mode separates by lightness steps, not by
shadow.

## 5. Components

- **Buttons:** compact, mono-labeled, 5px corners. Primary fill for the one
  action that matters.
- **Cards and containers:** a background step plus hairline; used for
  genuinely independent items (one risk, one decision), not for prose.
- **Inputs:** flat with hairline border, focus ring in primary.
- **Navigation / TOC:** mono labels, muted ink, current item in foreground.
- **Tables:** the flagship. Mono uppercase headers, hairline row rules,
  numeric and identifier columns in mono, row keys at semibold sans, state
  words colored by their status token. Wide tables scroll inside their own
  container on phones rather than reflowing into ambiguity.
- **Chart palette:** chart-1 through chart-5 in order; state colors are not
  chart colors.

### Signature moves

Use at least one; they give an engineering document its instrument-panel
character beyond the palette.

- **The status ledger.** A compact key / value / state strip near the top:
  mono labels, values, and state words colored by their status token. The
  reader's dashboard-in-a-line.
- **Traffic-light rows.** In tables, a state column carries a dot plus the
  state word (ok / warn / blocked); the row itself stays on canvas.
- **The mono metadata rail.** Document metadata in mono uppercase labels, so
  the instrument-panel texture is set from the first line. In `style.css`
  the rail stands beside the title like a datasheet, headings hang a mono
  `#` in the margin, and summaries and callouts are panels with a title bar.

## 6. Do's and Don'ts

Do:

- Put the highest-information table where the reader lands first.
- Label everything: metadata keys, table headers, states. Scanning is the
  primary read.
- Treat dark mode as a shipped surface; check both themes before delivery.
- Keep code blocks real: actual payloads, actual commands, correct syntax.

Don't:

- Don't inflate type scale for drama; density is the courtesy here.
- Don't tint rows or cards with state colors; mark the word, not the row.
- Don't use mono for prose or headings.
- Don't fake precision: no invented latencies, no placeholder SLAs. An
  unknown number is written as an open question.
- Don't add a KPI strip unless the document actually reports measured
  metrics.

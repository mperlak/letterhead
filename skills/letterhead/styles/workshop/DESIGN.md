---
name: Workshop
description: Session materials — coral energy, chunky rounded shapes, sticky-note accents, big friendly type. Playful but working.

# The colors below are the light theme. The dark theme is defined only in
# tokens.css next to this file. All colors are OKLCH.
colors:
  background: "oklch(0.9900 0.0025 85)"
  foreground: "oklch(0.2400 0.0080 60)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.2400 0.0080 60)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.2400 0.0080 60)"
  primary: "oklch(0.5700 0.1600 38)"
  primary-foreground: "oklch(0.9950 0.0020 85)"
  secondary: "oklch(0.9520 0.0100 80)"
  secondary-foreground: "oklch(0.3100 0.0140 62)"
  muted: "oklch(0.9640 0.0070 82)"
  muted-foreground: "oklch(0.4750 0.0180 65)"
  accent: "oklch(0.9450 0.0480 95)"
  accent-foreground: "oklch(0.4300 0.0800 75)"
  destructive: "oklch(0.5300 0.1850 28)"
  destructive-foreground: "oklch(0.9950 0.0020 85)"
  border: "oklch(0.9000 0.0130 78)"
  input: "oklch(0.9000 0.0130 78)"
  ring: "oklch(0.5700 0.1600 38)"
  chart-1: "oklch(0.5700 0.1600 38)"
  chart-2: "oklch(0.7200 0.1300 95)"
  chart-3: "oklch(0.6200 0.1000 210)"
  chart-4: "oklch(0.5800 0.1300 150)"
  chart-5: "oklch(0.5200 0.0100 65)"
  sidebar: "oklch(0.9700 0.0060 83)"
  sidebar-foreground: "oklch(0.2400 0.0080 60)"
  sidebar-primary: "oklch(0.5700 0.1600 38)"
  sidebar-primary-foreground: "oklch(0.9950 0.0020 85)"
  sidebar-accent: "oklch(0.9450 0.0480 95)"
  sidebar-accent-foreground: "oklch(0.4300 0.0800 75)"
  sidebar-border: "oklch(0.9000 0.0130 78)"
  sidebar-ring: "oklch(0.5700 0.1600 38)"

typography:
  display:
    fontFamily: "var(--font-display)"
    fontSize: "clamp(2.125rem, 5vw, 2.875rem)"
    fontWeight: 700
    lineHeight: 1.18
  heading:
    fontFamily: "var(--font-display)"
    fontSize: "1.5625rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-sans)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "1.03125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.78125rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "var(--font-mono)"
    fontSize: "0.90625rem"
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
    padding: "0.5rem 1.125rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
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

# Workshop

## 1. Overview

> "The handout people actually keep after the session."

Workshop is the register for session materials: agendas, exercises,
worksheets, whiteboard recaps. Warm coral energy, chunky rounded shapes,
sticky-note accent surfaces, and big friendly type make the document feel
like part of the room, while the underlying grid keeps it working-serious.

Key characteristics:

- Warm paper-white canvas, coral primary, sticky-note yellow accent.
- Chunky radii (10 to 24px), soft real shadows.
- Big friendly display (Rubik), roomy body.
- Checklist and exercise affordances are first-class citizens.
- Rejects: corporate stiffness, tiny type, gray-on-gray timidity.

## 2. Colors

Primary group: coral for headings' energy, current steps, and calls to
action. Accent: the sticky-note tint for exercise boxes and highlights.
Neutral group: warm grays. State: destructive red distinct from coral.
Charts: coral, yellow, sky, green, gray.

The yellow accent surface means "this is where
you write or do"; it never decorates passive prose.

## 3. Typography

Rubik for everything. Its rounded letterforms carry the friendly tone, so
the layout does not have to. The title is bold, headings semibold, body text
regular and generously sized. Mono is for timers, codes and counts only.

The fun comes from shapes and color, never from the type: keep it easy to
read, in sentence case, never slanted or outlined.

## 4. Elevation

Soft real shadows are welcome: cards sit slightly off the paper like
materials on a table. Dark mode keeps the warmth (warm charcoal, lifted
coral) for rooms with projectors and dimmed lights.

## 5. Components

- **Buttons:** pill-shaped, coral, generous padding.
- **Cards:** white, 18px radius, soft shadow; one exercise or one agenda
  block per card.
- **Inputs / write-in areas:** sticky-note tinted with a dashed border.
- **Navigation / agenda:** numbered steps with times, current step coral.
- **Tables:** friendly and open: warm hairlines, sentence-case headers.
- **Chart palette:** chart-1 through chart-5 in order.

### Signature moves

Use at least one; they make a workshop handout feel like part of the room.

- **Sticky-note boxes.** Exercises and write-in areas sit in accent-tinted
  boxes with a dashed border; the tint means "this is where you do something".
- **The timeboxed agenda.** The agenda is a numbered spine with times; the
  current step is coral.
- **Outcome cards.** Delivered results and key blocks sit in white rounded
  cards floating gently off the paper.

## 6. Do's and Don'ts

Do:

- Make every exercise box answer: what to do, with whom, in how long.
- Use the agenda's step numbers as the document's spine.
- Keep timeboxes real; a "10 min" label comes from the plan, not vibes.

Don't:

- Don't use the sticky-note tint for decoration.
- Don't shrink type to fit more in; cut content instead.
- Don't stack more than two accent surfaces on one screen.
- Don't use corporate-register tables with uppercase micro-headers.

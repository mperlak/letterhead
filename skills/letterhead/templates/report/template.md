---
name: Report
description: Findings from work already done: what was examined, what was found, what it means, and what to do about it.
---

# Report

The report carries a layout of its own: `report.css` and `report.js` next
to this file. `apply-template.mjs` puts them into the document in place of
the style's `style.css`; the brand and the style still give the colors,
fonts, radii and type scale through the tokens. Add document-level CSS only
for the content of a diagram, never to restyle the elements below
(SKILL.md, law 8).

## Use when

Work happened (research, analysis, an investigation, a measurement period)
and the reader needs its results with enough evidence to trust them and act
on them. The reader's questions are "what did you find" and "what should we
do".

## Do not use when

The document argues for future work; that is a proposal. It assesses
against a defined set of criteria with severities; that is an audit. It
recurs weekly on a running project; that is a status update. It closes a
project; that is a project recap.

## Build

```sh
node <skill>/scripts/apply-tokens.mjs <profile-dir> <file>
node <skill>/scripts/apply-template.mjs report <file>
```

Both are safe to repeat; `apply-tokens.mjs` puts the template in again
after it changes the tokens. Write the body in the markup below, inside
`<main class="doc report">`. `example.html` next to this file is a worked
report with every element in it (a fictional business, no tokens): read it
before writing, take its markup, never its content or numbers. Check the
result with `check-document.mjs --render` when a browser is at hand: it
catches a click that changes the words, which the HTML alone cannot show.

## Structure

1. **Head** (`header.doc-head`): `.brand-mark` when the tokens carry a
   logo, `p.kicker` with the document type and who it is for, `h1` with the
   thesis (a full sentence, about fourteen words at most), `p.lede` opening
   with `<strong>Document name:</strong>`, then `dl.meta` with the fields
   Date, Status, Owner, Audience and Scope (the period or the dataset
   covered), in the document's language. `<title>` and `og:title` carry the
   document's name, not the thesis; `og:description` carries the thesis.
   The kicker never stands in for the date field.
2. **Contents** (`nav.contents[aria-label]` right after the head): one
   `details > summary + ol` of links to every `h2`. The phone shows it as a
   folded jump list ("Go to section"), a wide screen as a sticky rail. A
   group label is `<li class="grp">`. One list, never a second copy.
3. **Summary** (the first section): `h2`, then `div.summary.wide` holding
   `ol.findings` (two to four `li > a[href="#finding-id"] > span.t + span.d`,
   each `.d` one sentence) and `aside.todo[aria-label]` with `p.label`,
   one sentence in `p.verdict` (what we do about it), a short `ol` of steps
   and a link to the decisions. Every `href` points at an existing `h2`.
4. **What was examined and how:** one section, short; the reader judges
   trust from it.
5. **Findings:** one `section` per finding, in order of importance. It
   opens with an optional `p.kicker` ("Finding 2"), then `h2[id]` (the claim
   as a sentence), `p.lede`, then the evidence. The kicker never goes into
   the id.
6. **Recommendations:** `ol.recs > li[id]`, each `<div><span class="t">…</span>
   …</div><span class="from">From finding 2</span>`.
7. **Decisions** (only when the reader has to decide): `section.ask` with a
   kicker, `h2`, one paragraph and an `ol` of questions, one under another.
8. **Appendix and sources:** below everything. Folded detail (a glossary,
   worked answers) is `details.more`; it prints open.

Close with `footer.doc-close` when the document needs a sign-off line.

## Sections and margin notes

Every `section` holds all of its content, from its kicker to its last
table. On a wide screen each section is a grid: the text column, a gap,
and a margin. A margin note is `<aside class="side">` placed right after
the element it explains and sharing its row: a source, a caveat, or one
number (`<span class="pull">55%</span>` plus what it counts and where it
comes from, in the same note). At most one note per element, shorter than
that element, at most one pull number per section. `.wide` (a figure, a
table, the summary) spans the text column and the margin. Below 900 px the
note drops into the text with a rule on its left.

## Containers

One container look: `figure`, `aside.todo`, `div.note` and `.callout` sit
on `--tint`, rounded, with no border and no shadow; their labels are
`p.label` in `--tint-ink`. Inside a container, a state or a part is a
`.panel` on `--card`. A figure without a caption is decoration; a container
around ordinary prose is a callout nobody needs.

## Interactive parts

Allowed: the stepper, the explorer, the chart tooltip. Each one replaces a
table or a list the reader would otherwise get, never adds to one.

- **Every state is in the HTML from the start, none of it `hidden`.** The
  script hides what is not active; without the script, and in print, every
  state shows as a plain list. The script only toggles `[hidden]` and aria
  state; it never writes text and never moves an element.
- **Stepper:** `ol.stepper > li > button.step[aria-expanded][aria-controls]
  + div.panel.step-body[id]`, the step's whole content inside its own `li`.
  Optional controls before the list: `div.stepper-ctl[hidden]` with buttons
  `data-stepper="prev|play|next"`; the script shows them. Play runs only
  on request, stops at any click, and never shows with reduced motion. No
  live counter.
- **Explorer:** `figure.explorer` with the parts as `[data-part="key"]`:
  `button.chip` in HTML, or `g[role="button"][tabindex="0"][aria-pressed]
  [aria-controls][aria-label]` inside an `svg[role="group"]` (never
  `role="img"`, which hides its buttons from a screen reader). Each
  description is `div.panel.part-detail[id][data-for-part="key"]`. Mark the
  part shown first with `aria-pressed="true"`. Prefer one HTML diagram
  (`.layers > .lay + p.lay-arrow`, `.lay.key` for the one that matters) for
  a linear flow; an SVG goes in `.explorer-wide` with an HTML twin in
  `.explorer-narrow`, which takes over when the container is under 56rem.
- **Chart:** `div.chart` with the `svg[role="group"]` and an empty
  `<div class="tip" aria-hidden="true" hidden></div>`; each point is
  `circle.hit[cx][cy][tabindex="0"][role="img"][aria-label]` and the
  label is the tooltip. The same numbers are in a table next to it.
- Accent words: `em.accent`, set in the brand's `--font-accent`, at most one
  per screen; the thesis in `h1` may carry one.

The document works in a frame with `sandbox="allow-scripts"` and no
`allow-same-origin`: no storage, no fetch, no external file. Controls work
from the keyboard and are never the only way to the content.

## Creation guidance

Every number in the report has a source in the examined material. Charts
and tables appear when the finding is quantitative; a finding carried by
one number can state it inline or as the section's pull number. Negative
results (nothing found, hypothesis not confirmed) are findings too and are
reported plainly. Two numbers for one fact (42% and 55% "of turns") get one
sentence on why they differ.

## Hierarchy contract

The thesis in `h1` is the loudest line; the summary is the strongest block
after it. Within a finding the claim leads and the evidence supports;
evidence never opens a section. Recommendations read as a compact list,
each citing its finding. The decision panel closes the document's body.

## Mobile contract

First two phone screens: thesis, lede, metadata, the jump list and the
whole summary with its "what we do" panel; keep each finding's `.d` to one
sentence so it fits. Tables scroll in `.table-wrap`. A diagram switches to
its HTML version by container width; SVG text never renders under 11 px. A
chart that cannot be read at phone width gives way to its number and table.

## Review contract

Stable ids per SKILL.md § Review-ready contract, on every `h2` and `h3`,
every recommendation, every step and every part description, slugged from
their text. Sections wrap their content, so a comment's position is counted
inside its section, not across the whole page. Nothing a reviewer can
comment on exists only in the script, and no interaction adds or removes
text: the comment layer anchors by element position and by a quote with
its occurrence number, counted over hidden text too.

## Failure modes

**Content only after a click.** A step's text written into the page by the
script when someone picks it: the comment on step 6 has nothing to anchor
to when the page opens on step 1, and the reviser cannot find the text in
the HTML.

**A flat main.** Fifty paragraphs, notes and tables as siblings of one
`main`, the section holding only its heading: one `nth-of-type` counter for
the whole page, so a new paragraph near the top moves every comment below.

**A white slab on a dark page.** The decision panel drawn in
`--foreground` turns into the brightest block in dark mode. It uses
`--surface-inverse`, which stays dark.

**Two contents lists.** A rail and a phone list kept by hand drift apart by
the next version. There is one `nav.contents`.

**Method theater.** Three screens of methodology before the first finding.
The reader came for findings; method is one honest paragraph.

**Claims without evidence.** A finding stated with nothing behind it reads
as opinion. If the evidence is weak, say how weak.

**Chronological dump.** Findings ordered by when the work happened instead
of what matters most.

**Recommendation drift.** Advice that follows from no finding in the
document. Every recommendation cites its finding.

**Fake precision.** "37.4% improvement" from a sample of five. Round to
what the data supports and show the base.

**Decoration as interaction.** A stepper for three steps, a quiz, a
simulator next to the table that already says it all. Interaction earns
its place by replacing a table or list.

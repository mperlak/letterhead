# Examples

Everything in this directory is generated output, kept as proof and gallery
material. Nothing here is part of the installable skill.

The set was regenerated on 2026-10-05 with the current skill, which builds
documents on the style layer (a `style.css` per style, the shared markup
vocabulary in `letterhead/reference/markup.md`, style fonts embedded, and
`apply-tokens.mjs --style`), by real headless runs of Claude `opus` (resolved
to `claude-opus-5-5`). Four fictional businesses, thirteen documents (the
meeting notes, an audit and a change walkthrough were added later), twelve
templates, nine styles, plus a real
presentation from BunnyFeelsHome, the author's studio. No HTML file here was edited by hand; where a run
polished its own output after writing it, that is the agent's own work and is
counted in the runs log.

## brands/

Four fictional brands, each taught by `teach` from a one-page homepage
written for the purpose (`site.html` in each folder, the only brand
evidence the teaching run saw). The profiles come from the first generation of
this set and were reused as they are for the regeneration: no run taught a
brand again. The `tokens.css` of Arkona, Fieldwork and Kestrel was derived
again later with `brand-tokens.mjs`, after its logo fixes, with the command
`teach` prescribes and the values in each `profile.meta.json`, and their
brand sheets were rendered again (see the second pass below). Each folder holds the taught profile as `teach`
wrote it: `profile.meta.json`, `DESIGN.md`, `PRODUCT.md`, `tokens.css`
(fonts embedded as woff2 data URIs, logo embedded), `logo.svg` and
`brand-sheet.html`. In a real project the profile would live in
`.letterhead/brands/<slug>/`.

| Folder | Business | Fonts (heading / body) | Colors | Base style |
|---|---|---|---|---|
| `arkona/` | Arkona, outdoor-furniture maker on Bornholm (DK) | Fraunces 600 / Work Sans | spruce green `#1d5c4d`, sand `#e8dcc6` | consulting |
| `fieldwork/` | Fieldwork Digital, a seven-person web-shop and integration agency in Aarhus (DK) | Space Grotesk 600 / Source Sans 3 | tomato `#d9432a`, mustard `#f1c84b`, near-black ink | consulting |
| `halde/` | Studio Halde, residential interior design studio in Amsterdam (NL) | Cormorant Garamond 500 / Jost | clay `#9a5b3f`, linen `#ece2d4` | atelier |
| `kestrel/` | Kestrel Labs, route planning software for waste collection, Rotterdam (NL) | Manrope 700 / IBM Plex Sans | cobalt `#1f4fd1`, amber `#f4b73c` | engineering |

`arkona/site.html` is the same file as `hero/arkona-site.html`. The Arkona
profile is also in `hero/brand/` (same run).

## documents/

Named `<template>--<brand>.html`. Each was written from short raw notes;
the notes and the exact prompt for each are in `notes/<same-name>.md`.

| Document | Template | Style | Written by, for |
|---|---|---|---|
| `status-update--arkona.html` | status-update | consulting (the profile's base; the prompt names none) | Fieldwork for its client Arkona, on Arkona's letterhead. Also `hero/after.html`. |
| `implementation-plan--arkona.html` | implementation-plan | boardroom | Fieldwork for Arkona's MD and e-commerce lead: the cutover and go-live plan to sign off |
| `checklist--arkona.html` | checklist | workshop | Fieldwork for both teams: the go-live weekend checklist, printed and ticked by hand |
| `proposal--fieldwork.html` | proposal | consulting | Fieldwork, on its own letterhead, to Arkona: phase 2 trade portal, price table in DKK, the ask |
| `project-recap--fieldwork.html` | project-recap | startup | Fieldwork to another client, Saltværk: a finished shop migration, budget and results |
| `meeting-notes--fieldwork.html` | meeting-notes | consulting (the profile's base; the prompt names none) | Fieldwork, on its own letterhead, to Arkona's team: notes from the weekly go-live call, decisions, action items with owners, two asks for Karin. Added 2026-10-06, see below. |
| `audit--kestrel.html` | audit | engineering (the profile's base; the prompt names none) | Kestrel to Gemeente Westerhaven's waste operations head, her security officer and the contractor's dispatch lead: an access and integration review of the tenant before the pilot, 8 findings by severity, a remediation table with owners and dates. Added 2026-10-06, see below. |
| `change-walkthrough--fieldwork.html` | change-walkthrough | consulting (the profile's base; the prompt names none) | Fieldwork to Arkona's customer service, warehouse and e-commerce leads: how order sync now handles out-of-stock lines after go-live, what changes for their staff, six steps to try on staging, four decisions to confirm. Added 2026-10-06, see below. |
| `proposal--halde.html` | proposal | atelier | Studio Halde to a private couple: an apartment, scope per room, three packages in EUR, timeline |
| `report--halde.html` | report | gazette | Studio Halde to new homeowners: what the pre-design survey of their 1932 house found |
| `spec--kestrel.html` | spec | engineering | Kestrel to a municipality and its contractor: missed-bin reports turned into same-day return stops |
| `release-notes--kestrel.html` | release-notes | corporate | Kestrel to customers' fleet managers and developers: release 4.3, two breaking API changes |
| `postmortem--kestrel.html` | postmortem | public-sector | Kestrel to municipal customers: the night the routes were not published by 05:00 |
| `presentation--bunnyfeelshome.html` | presentation | atelier (the profile's base) | BunnyFeelsHome, a real brand taught from its live site, to a client: the House on Hill interior visualisations, room by room (19 pictures, 8.5 MB). Added 2026-10-06, see below. |

All thirteen pass `check-document.mjs` with 0 errors, 0 warnings and 0 info
notes. Each carries light and dark themes in one file, embeds its brand's
fonts and its logo, and carries two generated head blocks:
`<style data-letterhead-tokens>` (fonts and tokens) and
`<style data-letterhead-style>` (the style's `style.css`). The body is the
shared markup (`<main class="doc">`, `doc-head`, `dl.meta`, `section` +
`h2 id`, and the vocabulary elements the content earns); the documents' own
`<style>` holds 0.4 to 2.1 KB. Nothing loads from the network.

## notes/

One file per document: the raw notes exactly as the model got them, the
prompt verbatim, and which session turn it was. The prompts are the ones of
the first generation, except `status-update--arkona`: its first-generation
prompt taught the brand from the homepage in the same turn, so for the
regeneration it names the already taught profile instead. All dates follow the 2026
calendar (5 October 2026 is a Monday); every weekday in the notes was
checked against it.

## How they were made

One headless Claude Code session per brand, run in a fresh directory outside
any repository (so no project `CLAUDE.md` and no other `.letterhead/` leaks
in), with the four sessions running in parallel. The taught profile of the
brand (everything in `brands/<slug>/` except `site.html`) was copied to
`.letterhead/brands/<slug>/` of the run directory beforehand, the notes to
`notes/` (`NOTES.md` for the status update), and each document was one turn:
the first turn of a session fresh, each later turn `--resume`.

```sh
claude -p "<prompt>" --model opus --setting-sources project,local \
  --plugin-dir <this repo> --permission-mode acceptEdits \
  --allowedTools "Read Write Edit Bash Skill" \
  --disallowedTools "Artifact ArtifactComments ArtifactData" \
  --output-format stream-json --verbose            # + --resume <session> after turn 1
```

These are the flags `hero/run.sh` uses. Every prompt approves the shape in
advance ("I approve in advance the shape you propose, so do not wait for my
confirmation"), so no turn stopped at the shape gate.

### Runs log

| Session | Turn | Style (`--style`?) | Wall time | Tool calls | Cost |
|---|---|---|---|---|---|
| arkona | status-update | consulting (profile base, none) | 119 s | 19 | $0.83 |
| arkona | implementation-plan | boardroom (`--style boardroom`) | 137 s | 12 | $1.48 |
| arkona | checklist | workshop (`--style workshop`) | 121 s | 8 | $2.06 |
| fieldwork | proposal | consulting (profile base, none) | 88 s | 12 | $0.66 |
| fieldwork | project-recap | startup (`--style startup`) | 82 s | 10 | $1.04 |
| halde | proposal | atelier (profile base, none) | 147 s | 16 | $0.93 |
| halde | report | gazette (`--style gazette`) | 88 s | 7 | $1.34 |
| kestrel | spec | engineering (profile base, none) | 114 s | 9 | $0.76 |
| kestrel | release-notes | corporate (`--style corporate`) | 66 s | 8 | $1.12 |
| kestrel | postmortem | public-sector (`--style public-sector`) | 63 s | 6 | $1.44 |

Total: 10 turns, about 17 minutes of model time (6 minutes 20 seconds wall
clock with the four sessions in parallel), $11.68, 107 tool calls. Every turn
succeeded on the first attempt; there were no retries.

**Skills invoked:** `letterhead:letterhead` only, once per session (in its
first turn); later turns worked from the skill already loaded in the
session. No other skill and no MCP tool was called in any turn (tools used:
Bash, Read, Write, Edit, Skill).

**Scripts the runs used:** `apply-tokens.mjs` and `check-document.mjs` in
every document. In the six turns whose requested style differs from the
profile's base style the agent passed `--style <style>` to `apply-tokens.mjs`
(the brand keeps its colors, fonts and logo in the other style); in the other
four it ran the script with the profile alone. No run needed
`brand-tokens.mjs`, which the first generation had to call to put a profile
into another style by hand. Each agent wrote the body in the shared markup,
read the template, `reference/markup.md` (first turn of the session) and the
style's `DESIGN.md`, and most also looked at the style's `style.css`.

**What the agents did after writing.** Seven of the ten turns changed their
own output after the first write and before the final check: wording fixes
by `Edit`, `sed`, `perl` or a short Python script, and in the Halde proposal
a rebuilt price table. The generated head blocks were never touched.

### Second pass: logo fixes

All three logos set their wordmark as live SVG `<text>`. Drawn as an image,
an SVG cannot reach the document's fonts, so the wordmarks fell back to
another face and clipped; the first Arkona documents redrew the logo by
hand instead. `brand-tokens.mjs` now embeds the wordmark's font in the SVG,
and gives multi-color artwork a recolored dark copy (`--brand-logo-dark`)
instead of a light plate. The Arkona, Fieldwork and Kestrel tokens were
derived again with it (Arkona: mask, wordmark in Fraunces; Fieldwork and
Kestrel: dark copy, ink turned light), and the tokens were applied again to
all ten documents with `apply-tokens.mjs` and the same `--style` as before.

Four documents were generated again, because their markup had to change:
the three Arkona documents (logo drawn from the tokens instead of by hand;
the checklist with `ul.checks` tick boxes) and the Halde report (the gazette
drop cap is now opt-in with `p.dropcap`). Same method, prompts and notes as
above: one arkona session of three turns, and the Halde report as the first
turn of a fresh session. The other six documents kept their text and only
took the new tokens.

| Session | Turn | Style (`--style`?) | Wall time | Tool calls | Cost |
|---|---|---|---|---|---|
| arkona | status-update | consulting (profile base, none) | 79 s | 12 | $0.68 |
| arkona | implementation-plan | boardroom (`--style boardroom`) | 115 s | 13 | $1.21 |
| arkona | checklist | workshop (`--style workshop`) | 89 s | 10 | $1.66 |
| halde | report | gazette (`--style gazette`) | 144 s | 22 | $0.98 |

Total: 4 turns, 7 minutes of model time, $4.53, 57 tool calls. Every turn
succeeded on the first attempt. No document draws its logo by hand; all
four use `apply-tokens.mjs` and `check-document.mjs`, and two changed their
own output after the first write (fixes by `Edit`, and a `sed` that
put non-breaking spaces after the euro signs).

### Presentation: BunnyFeelsHome

Added on 2026-10-06, separately from the set above and from a real brand, not
a fictional one: the owner's own, taught fresh from the live site
(`brands/bunnyfeelshome/`, no `site.html`, because it is a real page). The
interior visualisations are one project, "House on Hill" (the owner's own work,
published with permission). Version 1 was two turns of one headless session
(same flags as above): teach the brand, then build the presentation from 19
pictures in four rooms, no products. Version 2, the one in the repo, adds a
fifth room (Home office, 4 pictures) and six products with links to English shop
pages, no prices. Prompts, `links.txt`, and how each product was matched to the
pictures: `notes/presentation--bunnyfeelshome.md`.

| Version | Turn | Style (`--style`?) | Wall time | Tool calls | Cost |
|---|---|---|---|---|---|
| 1 | teach (live site) | atelier (the profile's base) | 69 s | 9 | $0.62 |
| 1 | presentation, 4 rooms, no products | atelier (profile base, none) | 68 s | 11 | $0.99 |
| 2 | presentation, 5 rooms, 6 products | atelier (profile base, none) | 381 s | 41 | $1.33 |

Version 2 ran in a fresh session: the transcript of version 1 was gone, so
there was nothing to resume, and the brand profile was copied into
`.letterhead/brands/` instead of being taught again. One attempt, no retries.
Skills invoked: `letterhead:letterhead`. Scripts: `prepare-images.mjs` (with
`--budget-mb 6.5`, set in the prompt), `product-cards.mjs` (twice) and
`build-presentation.mjs` (with `--no-prices`). The file is 8.6 MB; it passes
`check-document.mjs` with 0 errors and 0 warnings and one info note (the room
headings carry numbers, which the contents list refers to). The brand sheet is
in Polish, the language of the site; the presentation is in English because the
prompt asked for it.

What the second run showed about the template, left unchanged (`letterhead/`
was not edited): the two Nordlux pages fill in the product photo with
JavaScript, so `product-cards.mjs` found "no photo on the page" and the
"Blocked shops" procedure applied; a plain second run with `links.json` kept
the photo-less entries it had already read, and only `--refresh` applied the
given fields. The template does not mention `--refresh`. IKEA's English pages
differ by market: the sofa and the lamp have no page on ikea.com/gb or
ikea.com/pl (English), but do on ikea.com/de (English).

### Meeting notes: Fieldwork

Added on 2026-10-06 with the new `meeting-notes` template, separately from the
set above: one turn of a fresh headless session, same flags, the taught
`fieldwork` profile copied into `.letterhead/brands/fieldwork/` beforehand. The
raw notes are Signe's notes from Fieldwork's weekly go-live call with Arkona on
Wednesday 21 October 2026, between the status update (week 41) and the go-live
walkthrough (Thu 29 Oct); weekdays checked against the 2026 calendar. The
prompt names neither the template nor a style; the agent picked
`meeting-notes` and the profile's base style. Prompt and notes:
`notes/meeting-notes--fieldwork.md`.

| Attempt | Template version | Style (`--style`?) | Wall time | Tool calls | Cost |
|---|---|---|---|---|---|
| 1 (discarded) | first draft | consulting (profile base, none) | 123 s | 10 | $0.65 |
| 2 (in the repo) | header rule added | consulting (profile base, none) | 104 s | 10 | $0.72 |

Attempt 1 was a good document with a crowded header: seven metadata fields
written as sentences (roles, why Henrik and Jens were away, the next meeting),
which pushed the summary to the third phone screen. The template then got the
rule that header fields hold names and the reasons go in the notes (failure
mode "The crowded header"), and the decisions markup (a plain `ul`, the name in
`<em>`). Attempt 2 ran in a fresh directory with the same prompt and notes: five
short fields, the summary at the foot of the first phone screen. Both attempts
invoked `letterhead:letterhead` only and ran `apply-tokens.mjs` and
`check-document.mjs`; attempt 2 changed its own output once by `Edit` before the
final check. The file passes `check-document.mjs` with 0 errors, 0 warnings and
0 info notes; its own `<style>` is 0.5 KB (a `ul.decisions` class it added for
the decision list). The agent kept the gaps in the notes visible instead of
filling them: Ines's "asap" item says "no date set", and Fieldwork's people
keep the first names the notes give.

### Audit and change walkthrough: Kestrel, Fieldwork

Added on 2026-10-06 with the `audit` and `change-walkthrough` templates, so that
every template has a document here. Each is one turn of a fresh headless
session (same flags), the taught profile of the brand copied into
`.letterhead/brands/<slug>/` of the run directory beforehand; the two sessions
ran in parallel. The raw notes are fictional and follow the 2026 calendar
(weekdays checked): Ruth Okafor's notes from a two-day access review of
Gemeente Westerhaven's Kestrel tenant (Tue 13 and Wed 14 Oct, issued Thu 15
Oct), and the notes of Signe and Tomasz on the out-of-stock change Fieldwork
shipped to Arkona's shop on Wed 11 Nov, written up on Thu 12 Nov. Neither
prompt names a template or a style; the agents picked `audit` and
`change-walkthrough` and each profile's base style. Prompts and notes:
`notes/audit--kestrel.md`, `notes/change-walkthrough--fieldwork.md`.

| Attempt | Document | Template version | Wall time | Tool calls | Cost |
|---|---|---|---|---|---|
| 1 (discarded) | audit--kestrel | before the head rule | 135 s | 9 | $0.83 |
| 1 (discarded) | change-walkthrough--fieldwork | before the head rule | 150 s | 16 | $0.97 |
| 2 (in the repo) | audit--kestrel | head rule in `reference/markup.md` | 155 s | 14 | $1.00 |
| 2 (in the repo) | change-walkthrough--fieldwork | head rule in `reference/markup.md` | 162 s | 19 | $1.03 |

Both used the profile's base style (no `--style`). Attempt 1 was good in content
but had a crowded head: nine metadata fields in the audit (in the engineering
style's left column, so the title column had empty space beside it) and eight
in the walkthrough (a second, short row in the meta grid). The skill then got a
general rule in `reference/markup.md`: `dl.meta` holds five fields at most, the
rest goes in the first section or the close. Attempt 2 ran in fresh run
directories with the same prompts and notes: five fields in each head (audit:
date, prepared by, for, subject, status; walkthrough: for, from, date, live
since, reply by), the verdict and the "what we need from you" box still on the
first screen. Attempt 2 of the audit has the same eight findings, now with an
"Annex C at a glance" tile grid of the twelve requirements before them.

Both attempts invoked `letterhead:letterhead` once and ran `apply-tokens.mjs`
and `check-document.mjs`; the files in the repo pass with 0 errors, 0
warnings and 0 info notes. The attempt-2 audit did not change its output
after the first write; the attempt-2 walkthrough made three `Edit`s to its own
output before the final check. Together the attempts cost $3.83. The documents follow their template's
structure: the audit has the verdict directly under the header, a severity
scale, findings of identical anatomy with ids from their short names, a pass
list and a remediation table with owners and dates; the walkthrough has the
what-we-need box, six tour stops, an honest "things that surprised us"
section, a six-step check on staging, and what a yes and a no set off.

## screenshots/

Captures of the documents and brand sheets are rebuilt separately
(`dev-scripts/screenshots.mjs`). `hero-before-after-{light,dark}.webp` come
from `hero/build-hero.sh`. `presentation--bunnyfeelshome-wide-{light,dark}.webp`
are 1600 px wide at 2x and 2100 px tall (a taller crop than the 4:5 thumbnails,
so the cover and the first room's pictures show together).

# Examples

Everything in this directory is generated output, kept as proof and gallery
material. Nothing here is part of the installable skill.

The set was regenerated on 2026-10-05 with the current skill, which builds
documents on the style layer (a `style.css` per style, the shared markup
vocabulary in `letterhead/reference/markup.md`, style fonts embedded, and
`apply-tokens.mjs --style`), by real headless runs of Claude `opus` (resolved
to `claude-opus-5-5`). Four fictional businesses, ten documents, nine
templates, nine styles. No HTML file here was edited by hand; where a run
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
| `proposal--halde.html` | proposal | atelier | Studio Halde to a private couple: an apartment, scope per room, three packages in EUR, timeline |
| `report--halde.html` | report | gazette | Studio Halde to new homeowners: what the pre-design survey of their 1932 house found |
| `spec--kestrel.html` | spec | engineering | Kestrel to a municipality and its contractor: missed-bin reports turned into same-day return stops |
| `release-notes--kestrel.html` | release-notes | corporate | Kestrel to customers' fleet managers and developers: release 4.3, two breaking API changes |
| `postmortem--kestrel.html` | postmortem | public-sector | Kestrel to municipal customers: the night the routes were not published by 05:00 |

All ten pass `check-document.mjs` with 0 errors, 0 warnings and 0 info
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

## screenshots/

Captures of the documents and brand sheets are rebuilt separately
(`dev-scripts/screenshots.mjs`). `hero-before-after-{light,dark}.webp` come
from `hero/build-hero.sh`.

# Examples

Everything in this directory is generated output, kept as proof and gallery
material. Nothing here is part of the installable skill.

The set was made on 2026-10-05 with letterhead 0.1.0 and Claude
`opus` (resolved to `claude-opus-5-5`), by real headless runs of the skill.
Four fictional businesses, ten documents, nine templates, nine styles. No
HTML file here was edited by hand.

## brands/

Four fictional brands, each taught by `teach` from a one-page homepage
written for the purpose (`site.html` in each folder, the only brand
evidence the run saw). Each folder holds the taught profile as `teach`
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

All ten pass `check-document.mjs` with 0 errors and 0 warnings (three
info notes in the two Fieldwork documents). Each carries light and dark
themes in one file and embeds its brand's two fonts and its logo; nothing
loads from the network.

## notes/

One file per document: the raw notes exactly as the model got them, the
prompt verbatim, and which session turn it was. All dates follow the 2026
calendar (5 October 2026 is a Monday); every weekday in the notes was
checked against it.

## How they were made

One headless Claude Code session per brand, run in a fresh directory outside
any repository (so no project `CLAUDE.md` or existing `.letterhead/` leaks
in), with the four sessions running in parallel:

```sh
claude -p "<prompt>" --model opus --setting-sources project,local \
  --plugin-dir <this repo> --permission-mode acceptEdits \
  --allowedTools "Read Write Edit Bash Skill" \
  --disallowedTools "Artifact ArtifactComments ArtifactData" \
  --output-format stream-json --verbose            # + --resume <session> after turn 1
```

These are the flags `hero/run.sh` uses. The first turn of each session
taught the brand from its `site.html`; each later turn (`--resume`) wrote one
document. Every prompt approves the brand reading and the shape in advance
("I approve in advance the shape you propose, so do not wait for my
confirmation"), so no turn stopped at the shape gate. The Arkona session's
first turn is `hero/run.sh <dir> after` itself (`hero/PROMPT.md`, which
teaches the brand and writes the status update in one turn).

### Runs log

| Session | Turn | Wall time | Tool calls | Cost |
|---|---|---|---|---|
| arkona | teach + status-update (`hero/run.sh`) | 193 s | 21 | $1.33 |
| arkona | implementation-plan | 155 s | 9 | $2.05 |
| arkona | checklist | 151 s | 8 | $2.72 |
| fieldwork | teach | 58 s | 6 | $0.62 |
| fieldwork | proposal | 121 s | 14 | $1.31 |
| fieldwork | project-recap | 116 s | 11 | $1.97 |
| halde | teach | 75 s | 12 | $0.67 |
| halde | proposal | 115 s | 7 | $1.20 |
| halde | report | 103 s | 4 | $1.66 |
| kestrel | teach | 67 s | 11 | $0.66 |
| kestrel | spec | 162 s | 15 | $1.52 |
| kestrel | release-notes | 102 s | 9 | $2.05 |
| kestrel | postmortem | 131 s | 14 | $2.69 |

Total: 13 turns, about 25 minutes of model time (8 minutes 20 seconds wall clock, 14:33 to 14:42,
with the sessions in parallel), $20.47. Every turn succeeded on the first
attempt; there were no retries.

**Skills invoked:** `letterhead:letterhead` only, once per session (in the
first turn); the later turns worked from the skill already loaded in the
session. No other skill and no MCP tool was called in any turn (tools used
across all runs: Bash, Read, Write, Edit, Skill).

**Scripts the runs used:** `brand-evidence.mjs`, `brand-tokens.mjs`,
`brand-sheet.mjs` (teach), `apply-tokens.mjs` and `check-document.mjs`
(every document). In all six turns whose requested style differed from the
profile's base style, the agent ran `brand-tokens.mjs` again with that
style's `tokens.css` and the profile's values, wrote the result to a scratch
file outside the profile and applied that. The profiles themselves were not
changed. `reference/create.md` does not describe this step; the agents worked
it out.

## screenshots/

Captures of the documents and brand sheets are rebuilt separately
(`dev-scripts/screenshots.mjs`). `hero-before-after-{light,dark}.webp` come
from `hero/build-hero.sh`.

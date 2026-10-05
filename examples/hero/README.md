# README hero: before / after

The image at the top of the repo README
(`examples/screenshots/hero-before-after-{light,dark}.webp`) puts two
documents built from the same `NOTES.md` side by side:

- **Left, `before-slop.html`: an illustration, not a model run.** A
  hand-written stand-in for the generic agent-made status update (Inter,
  purple-to-blue gradients, gradient text, emoji icon tiles, the three-card
  grid, a "Generated with AI" footer), with no brand. The image labels it
  "The usual agent-made update" and claims nothing about a specific model.
- **Right, `after.html`: a real run** of Claude with letterhead, unedited.

Why the left side is an illustration: the honest run without the skill
(`before-run.html`, below) was given the client's site and asked for "their
brand", and the model copied the brand well. That pair shows what letterhead
adds (dark theme, stable ids, a reusable brand profile, a clean
`check-document`), but not in a still image, so it is kept here as a record
and not used as the hero.

Rebuild the hero with `bash examples/hero/build-hero.sh` (defaults to
`before-slop.html` and `after.html`).

## The model runs (record)

Two runs of the same agent on the same task: same notes, same prompt, same
model; the only difference is whether the letterhead skill is available.
Neither output HTML is edited by hand.

## Inputs

| File | What it is |
|---|---|
| `arkona-site.html` | Homepage of Arkona, a fictional Bornholm outdoor-furniture maker. Used as the brand evidence: spruce-green primary on buttons, links and nav, Fraunces + Work Sans from Google Fonts, an inline SVG wordmark in the header. |
| `NOTES.md` | Raw weekly status notes from a fictional agency (Fieldwork Digital) to Arkona about a webshop + ERP order-sync migration. |
| `PROMPT.md` | The one prompt both runs get, verbatim. It pre-approves the shape gate and the teach confirmation, so both runs finish without a second turn. |

## Commands

```sh
bash examples/hero/run.sh /tmp/letterhead-hero-runs      # both runs, ~minutes each
cp /tmp/letterhead-hero-runs/before/status-update.html examples/hero/before-run.html
cp /tmp/letterhead-hero-runs/after/status-update.html  examples/hero/after.html
cp -R /tmp/letterhead-hero-runs/after/.letterhead/brands/arkona examples/hero/brand
bash examples/hero/build-hero.sh                          # screenshots + compose + cwebp
node letterhead/scripts/check-document.mjs examples/hero/after.html
```

What `run.sh` runs in each fresh directory (copies of `arkona-site.html` and
`NOTES.md` only, outside any repo, so no project `CLAUDE.md` or existing
`.letterhead/` profile leaks in):

```sh
# before: every skill disabled
claude -p "$(cat PROMPT.md)" --model opus --plugin-dir <repo> --disable-slash-commands \
  --permission-mode acceptEdits --allowedTools "Read Write Edit Bash Skill" \
  --output-format stream-json --verbose

# after: identical, without --disable-slash-commands
claude -p "$(cat PROMPT.md)" --model opus --plugin-dir <repo> \
  --permission-mode acceptEdits --allowedTools "Read Write Edit Bash Skill" \
  --output-format stream-json --verbose
```

`--plugin-dir <repo>` loads this repo the way the Claude Code plugin install
does (`letterhead:letterhead`). The transcript of each run is kept as
`transcript.jsonl` next to its output; `summarize.mjs` prints the model, the
skills invoked, the letterhead scripts run, turns, duration and cost.

`build-hero.sh` captures each document's first screen at 1200 x 1500 CSS px,
2x, in light and dark (prefers-color-scheme; a document without a dark theme
is shown as it renders under a dark preference), lays them side by side with
`compose.html` and encodes 2400 px wide WebP with `cwebp -q 82`. It uses
Playwright's cached `chrome-headless-shell` (or `CHROME=`).

## Run log

Date: 2026-10-05. Model: `opus` (resolved to `claude-opus-5-5`). Both sides
ran in parallel with `--setting-sources project,local` (no user-level skills
or plugins in either run) and Artifact tools disallowed. Summaries:
`runs/{before,after}-summary.json`.

| Side | Attempts | Wall time | Skills invoked | Tool calls | Cost |
|---|---|---|---|---|---|
| before | 1 | 97 s | none (0 available) | 8 | $0.67 |
| after | 1 | 206 s | `letterhead:letterhead` only | 28 | $1.43 |

The after run taught the brand (`brand-evidence.mjs --save-logo`,
`brand-tokens.mjs`, `brand-sheet.mjs`, profile in `brand/`), wrote the
document from the `status-update` template and ran `apply-tokens.mjs` and
`check-document.mjs`. Neither run needed a second turn.

`check-document.mjs`:

- `after.html`: 0 errors, 0 warnings, 2 info (`doc/no-metadata-block`,
  `doc/section-numbers`).
- `before-run.html`: 15 errors, 2 warnings (headings without stable ids, among
  others).

Both runs flagged the same input problem: the weekdays in `NOTES.md` match
the 2025 calendar (in 2026, 6 Oct is a Tuesday). Both kept the dates as
written.

Without the skill the model still put the document in Arkona's brand, because
the prompt says "in their brand" and gives it the site. The differences are
mostly ones a screenshot does not show: a dark theme (only `after.html` has
one), fonts embedded in the file (`before-run.html` loads Google Fonts), labeled
metadata at the title, and heading ids that survive the next version.

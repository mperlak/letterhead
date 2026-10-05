# Creation procedure (default `/letterhead <topic-or-path>`)

Apply the shared rules in SKILL.md first: absolute bans, review-ready
contract, brand precedence, universal laws.

The output is always one self-contained HTML file. No external scripts,
stylesheets, fonts, or images. Anything the document needs travels inside it
(inline CSS, data-URI assets). Review tools render documents in sandboxed
frames where external fetches fail, and recipients forward files without the
folder next to them. That includes the brand's fonts: a taught profile's
`tokens.css` carries them as `@font-face` rules with `data:` files, and they
reach the document with the tokens. A Google Fonts `<link>` shows the
brand's type on your machine and a fallback in every review frame.

## Preflight

1. **Context.** What is the document for, who reads it, what should the
   reader do after reading. If the source material does not answer these,
   ask.
2. **Brand lock.** Resolve the brand per SKILL.md precedence. Record the
   binding invariants: named fonts, named colors or color system, named
   anti-references, voice register. Absence in a category is a valid
   answer; do not invent invariants. If the user named a brand ("for
   Acme"), that brand's profile in `.letterhead/brands/<slug>/` is the lock,
   not the default brand in `.letterhead/brand/`.
3. **Template.** Pick from `templates/*/template.md` using the Use when /
   Do not use when sections. State the pick and a one-line reason. If no
   template fits without inventing content the source lacks, pick the
   closest and adapt its structure; say so.
4. **Section sketch.** List the sections in reading order, derived from the
   source's own structure, not from template convention. Note per section
   which one needs a primitive beyond prose: a table for comparison, a code
   block for a payload, a numbered flow for a sequence. Sections that need
   nothing extra stay prose.

## Shape gate

Stop before any file write. Present in plain conversational markdown:

- **Template** and the one-line reason.
- **Brand:** which profile or style anchors the look, and the binding
  invariants in one line.
- **Sections** in order.
- **Signature move:** which of the style's signature moves this document will
  carry, and where. One line. This is the composition choice that makes the
  document more than tokens in a plain shell.
- **Mobile shape:** what the first two phone screens show, what compresses
  or collapses.
- One question at the end, answered with a yes or with edits.

Show only decisions the build will actually carry: a token in the profile's
`tokens.css`, a template rule, or CSS this document writes. When the brand
or the request suggests something the skill cannot express, say so in the
gate in one line and name what the document will do instead. A promised
accent color that no token carries disappears without a word, and the user
finds out on the finished document.

Wait for the user. The agent saying yes to its own plan does not count. If the user hands back
edits, apply them to the plan and confirm once more only if the changes are
structural.

## Build (after the user's yes)

The `presentation` template is the exception to steps 2 to 7 below: its
scripts lay out the pictures, put in the tokens and the stable ids, and run
the check. Follow the procedure in `templates/presentation/template.md`;
the shape gate, the brand lock and the phone and theme review still apply.

1. Read the chosen `template.md` end to end. Its structure, hierarchy
   contract, mobile contract, review contract, and failure modes are the
   spec for this document.
2. Write the document with its own `<style>` for layout, then put the
   resolved tokens into it with the script, never by hand:
   ```sh
   node <skill>/scripts/apply-tokens.mjs <profile-dir> <file>
   ```
   With no profile, pass the style's file instead
   (`<skill>/styles/<style>/tokens.css`). The script inserts the whole
   `tokens.css` as one `<style data-letterhead-tokens>` block in `<head>`,
   ahead of the document's own styles: the embedded fonts, the logo, and
   the three selector blocks, which travel together:
   - `:root` carries light tokens,
   - `[data-theme="dark"]` carries the explicit dark override,
   - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):not([data-theme="dark"]) { ... } }`
     carries the same dark tokens for raw files opened with no theme
     attribute set.
   Run it again after the tokens change; it replaces the block instead of
   adding a second one. Pasting 100 KB of tokens by hand is where a
   document loses its dark blocks or its fonts, and a one-off script to do
   the pasting is a detour. A profile whose `DESIGN.md` says documents are
   always light still ships all three blocks: the reader picks the theme,
   and light is only the default look and the printed one.
3. **Head.** `<title>` is the document title. Add
   `<meta property="og:title">` with the same title and
   `<meta property="og:description">` with the lead sentence. A link
   pasted into chat without them previews as a bare URL, and the checker
   warns until they are there. `apply-tokens.mjs` adds a
   `<link rel="icon">` in the primary color when the document has none.
4. **Logo.** Draw it from the tokens, as a sized element with
   `role="img"` and an `aria-label` with the brand name, never as an
   `<img>` with a second copy of the data URI. Size the box from
   `--brand-logo-ratio` (width over height of the artwork), so nothing has
   to decode the image. Which snippet depends on the tokens:
   - **`--brand-logo-mask` is present** (single-color artwork): draw the
     shape as a mask filled with `--brand-logo-color`. Each theme sets that
     color, so the logo is dark on paper and light in dark mode from one
     copy, with nothing behind it:
     ```css
     .brand-mark {
       display: block; height: 40px; width: calc(40px * var(--brand-logo-ratio));
       background-color: var(--brand-logo-color);
       -webkit-mask: var(--brand-logo-mask) left center / contain no-repeat;
       mask: var(--brand-logo-mask) left center / contain no-repeat;
       print-color-adjust: exact; -webkit-print-color-adjust: exact;
     }
     ```
   - **Otherwise** (multi-color artwork, or artwork on a dark band): draw
     `--brand-logo` as the background. When the tokens define
     `--brand-logo-plate`, the padding goes outside the sized box, so the
     plate hugs the artwork instead of leaving an empty strip beside it:
     ```css
     .brand-mark {
       display: block; box-sizing: content-box;
       height: 40px; width: calc(40px * var(--brand-logo-ratio));
       padding: 6px 10px; border-radius: 3px;
       background: var(--brand-logo) left center / contain no-repeat;
       background-origin: content-box;
       background-color: var(--brand-logo-plate, transparent);
       print-color-adjust: exact; -webkit-print-color-adjust: exact;
     }
     ```
     The plate is transparent in light mode and light in dark mode, so
     multi-color artwork keeps a surface it can be read on. When `:root`
     says `--brand-logo-on: dark`, the header band behind the logo is
     `var(--brand-logo-plate)`, which stays dark in both themes.
   Without a logo token, set the name as a text mark in the display face.
5. Write the content in the brand's voice. Facts come from the source; open
   points become labeled open questions, never invented filler.
   - **Content given verbatim** (`polish`, or text the user wrote and wants
     laid out): the words are theirs. Skip any template hint that would add
     text (the proposal's "ask echoed in the lead" when their lead does not
     echo it); the ban on invented content beats the template.
   - **Document language differs from the profile's** (`lang` in
     `profile.meta.json`): the brand's voice governs what you write
     yourself, in the document's language. Text you were given is never
     translated.
6. **Signature-move pass.** Read the resolved style's `DESIGN.md`
   § Signature moves (every shipped style has one; a taught brand profile may
   too). Instantiate at least one move that fits the document, in the first
   viewport where it can land. These are what separate a styled document from
   the same palette poured into a generic shell: the gazette masthead, the
   consulting numbered spine, the boardroom cover line. Tokens are the paint;
   the signature move is the composition. A document that uses only the tokens
   and a plain shared layout has skipped this step. Never force a move that
   fights the source (no masthead on a two-line status update); pick the one
   the content earns.
7. **Stable-id pass.** Give every `h2`/`h3` an id slugged from its text:
   lowercase, drop leading section numbers, strip punctuation, spaces to
   hyphens. "5. Error handling and retries" → `error-handling-and-retries`.
   When regenerating or revising an existing document, first read the
   previous version's heading ids and keep them for every section that
   still exists, even if the heading text was edited slightly. New sections
   get new slugs. Renamed-in-place sections keep the old id; the anchor
   matters more than the cosmetic match.
8. Check both themes and the phone width before calling it done. The first
   two phone screens are a composed reading state: title, thesis, labeled
   metadata, first section. No metadata chip soup, no hero that eats the
   viewport.
9. Run the check:
   ```sh
   node <skill>/scripts/check-document.mjs <file>
   ```
   Fix every error; the script exits non-zero while any remain. Warnings
   and info are judgment calls; say which you left and why.
10. Report: file path, template used, brand used, the signature move you used,
   and check results in one line each. Offer `publish` if the document is
   meant for review.

## Revising an existing document (`polish`, or edits after feedback)

Work as a diff against the file, never a fresh generation. Read the current
file first. Preserve every existing heading id (law 2 and build step 7).
If feedback asks for a new section, slug its id from the new heading text.
If the requested change would touch more than roughly a third of the file,
say so and ask whether a fresh document is actually wanted.

## Failure modes

**Invented content.** The template asked for a risks section, the source has
no risks, and the document ships three fabricated risks. If the source lacks
a section's content, drop the section or mark it as an open question for the
reader.

**Brand drift.** The profile names a font and the document leads with a
generic sans, or the profile is OKLCH and the document ships ad-hoc hex.
The brand lock from preflight is binding at build time. Audit the authored
CSS against it before delivering, silently, and fix violations before the
user sees the file.

**Id churn.** A revision regenerates the document and every heading id
changes. Every comment anchored to the previous version is now orphaned.
This is the one failure this skill can never ship; it breaks the loop the
documents exist for.

**Theater.** Progress bars without data, KPI tiles without numbers, a
timeline with fake dates. If the number does not exist in the source, the
primitive does not appear in the document.

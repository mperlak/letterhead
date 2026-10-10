---
name: Brand sheet
description: A one-page sheet that shows a brand's owner the brand we captured — logo, colors, type, tone, composition — and asks only the few things a wrong answer would ruin the first document over.
---

# Brand sheet

**This sheet is generated, not composed.** `scripts/brand-sheet.mjs` renders
it from the profile files in a fixed layout, and runs
`check-document.mjs` on its own output. The agent's only inputs are
`notes`, `questions`, `preview` and `lang` in `profile.meta.json`. This file
describes what the generated sheet contains, so the contract can be checked
and argued with; it is not instructions for hand-writing HTML. An agent that
composes the sheet itself spends ten minutes on markup the script produces
in a second, and ships dark-mode CSS nobody checked.

## Use when

A profile has just been taught and its owner has not commented on it yet.
The sheet is reviewed before the first document is written in that name,
so an unconfirmed brand does not carry a client deliverable. Return the
file for review, with an optional offer to publish it in Markloop for
comments. Its job is to be corrected.
It should be readable in two minutes, so somebody can point at the amber
swatch and say
"that is the right one" or "no, that is the old site".

Also use it when a profile is refreshed after a rebrand and the changed
fields need the same round of comments.

## Do not use when

The owner has already said so and nothing changed; re-sending the sheet
asks people to comment on what they already settled. The profile is your
own and you are the only reader; look at the files. The document is meant
to teach a design system to a team building interfaces; that is a different document with a
different reader, and this sheet is deliberately too small for it.

## Structure

One page, in the language named by `lang`, rendered on the brand's own
tokens, so the sheet is itself the first sample of the work.

**Header:** `<title>` is "Brand sheet: <name>", localized at render
("Arkusz marki: Arkona Supply" when `lang` is `pl`). Labeled metadata in the
reading flow: brand, the sources the profile was built from, date, status
"open for comments".

Seven sections, always the same, always in this order:

1. **Logo and name** (`logo-and-name`). The logo on the background it is
   legible on, per `--brand-logo-on`: light artwork on a dark band, dark
   artwork on paper, captioned as the document header, at the artwork's own
   proportions. While the `logo` field is not `confirmed`, a second panel
   beside it: for artwork on paper, a dark-mode panel showing what a reader
   in dark mode gets (the mark in the dark theme's color, the recolored dark copy, or the logo on
   its light plate); for artwork on a band, bare paper, so the reason for the band is visible
   rather than described. Once the owner has confirmed the logo, the header
   panel stands alone. With no usable logo, the text mark from the name
   stands in and says so. Carries `notes.name` and `notes.logo`.
2. **Colors** (`colors`). Primary, text, background, and the supporting tint
   the tokens derived. Each one a swatch large enough to judge, the value in
   the notation a designer would use, and the field's `note` as one sentence
   of provenance ("51 occurrences, buttons and navigation"). `guessed` fields
   carry a visible "please check" label next to the swatch, not in a legend at
   the bottom. A label is not a question: it says how sure we are and invites
   a comment.
3. **Typography** (`typography`). Body and heading faces in a sample
   paragraph of the brand's own language, at the size documents actually use,
   at the captured heading weight, set in the embedded fonts, so the sample
   is the real type and not the reader's fallback. Name the faces. A face
   that could not be embedded and was replaced by an open substitute is a
   `guessed` field: it carries the "please check" label and the note naming
   both faces. When heading and body are the same face at different weights,
   show that instead of inventing a contrast.
4. **Tone** (`tone`). The sample paragraph from `PRODUCT.md`, presented as
   "this is how we would write in your name", plus `notes.tone`. Then three
   words we will not use, from the profile's anti-references; when none were
   named, three words verifiably absent from the brand's own copy. The three
   words are what makes this section answerable; a tone paragraph alone gets
   a nod and no correction.
5. **Composition** (`composition`). One sentence pointing at the preview,
   where the layout is shown rather than named. The profile's composition
   fields are not listed: nothing applies them, and a sheet that shows them
   as settings invites a correction that changes no document. A style's name means
   nothing to the brand's owner; "composition from the atelier style" is a
   sentence nobody can comment on. Never a question.
6. **Questions** (`questions`). The `questions[]` from the meta file, in
   order, each rendered as its own `h3` whose id is the question's `id`
   (`q-name-form`), with its `why` line underneath. At most five, usually
   two. The section ends with one sentence inviting a comment on anything
   else that is not theirs, which is where every non-question correction
   lands.
7. **Preview** (`preview`). A document in this brand, laid out by the base
   style's own `style.css` on the shared markup, so the owner sees the
   style's composition and signature moves, not a card that resembles none
   of them. With a real `preview`: that document's head (title from
   `preview.title`, labeled metadata with `preview.nextStep`) and its
   summary from `notes.preview`. With no `preview` (the default at teach
   time, before any document exists) the script renders a short document
   about the profile itself, labeled as a sample: what was read and how
   sure each field is (a status ledger from the confidences), the brand
   colors with their swatches, the questions waiting, and the next steps
   of the review. Every line is true of the profile, so nothing is
   invented; a made-up project here is the first thing the owner asks
   about. A style without a `style.css` falls back to a plain card.
   This is the section that turns an abstract palette into something the
   reader recognizes as their own document.

## Hierarchy contract

Sections 1 to 3 are the identity; they read fast and carry the weight of the
page. Section 6 is the point of the document, so it is visually distinct and
easy to arrive at from the top; a reader who scrolls past the swatches must
land on the questions, not wander. The preview is last and looks like a
document, not like a sample card, which means it inherits the document's own
type scale rather than shrinking into a thumbnail.

Swatches are labeled objects, not decoration. No color grid without values.

## Mobile contract

First phone screen: title, metadata, logo and name, with a 16 px side
margin on everything, header included. Swatches wrap to one or
two per row and keep their label, value and provenance sentence together; a
swatch that wraps away from its caption is an unanswerable question. The
preview scales down as text, never as a shrunken screenshot. The questions
stay a list, one per screen-height at most, each still its own heading.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with two additions.

- **The seven section ids are fixed and language-independent:**
  `logo-and-name`, `colors`, `typography`, `tone`, `composition`,
  `questions`, `preview`. Headings are localized, ids are not. This is what
  makes a comment survive a regenerated sheet and what makes a Polish sheet
  and an English one comparable; ids slugged from localized headings change
  the moment the language or the wording does, and every thread orphans.
- **Every question is individually anchorable.** Each question is an `h3`
  carrying the `q-<slug>` id from the meta file, so a comment lands on that
  question and not on the section. This is the entire mechanism of the
  sheet: people answer by commenting in place.

The sheet is self-contained: tokens inlined with their embedded fonts, no
remote fonts or images. The logo exists once, as the data URI in the
tokens; every mark on the sheet draws it from the tokens (a mask filled
with `--brand-logo-color` for single-color artwork, `var(--brand-logo)`
otherwise), which also lets the dark-mode panel pick up the dark color. An `<img>` per mark repeated a
150 KB logo four times and made a one-page sheet half a megabyte. It names no tool, no skill, and no third-party project
anywhere in the rendered output. The reader is looking at their own brand,
delivered by the person who sent it.

## Failure modes

**A questionnaire instead of a sheet.** More than five questions, or a
question under every field. The reader answers the first three, gets bored,
and lets the rest pass in silence, so the one question that mattered gets the
same weight as the tint question. The sheet shows everything and asks almost
nothing.

**Swatches without provenance.** A row of colors with hex values and nothing
else. Nobody can tell which ones we are sure about, so they let all of them
pass, and the guess becomes the brand.

**The design-system doc.** Spacing scales, component states, a type ramp
with every step, four pages of it. That document asks the reader to judge
our craft; this one asks them to correct two facts. Anything the reader
cannot answer does not belong on the sheet.

**Questions merged into prose.** "We are not certain about the name form and
the logo variant." Two questions in one sentence get one answer, usually to
whichever half the reader noticed. One question, one heading, one id.

**Logo on the wrong background.** Light artwork dropped on paper, or a dark
mark on the dark band. The header reads as empty or as a smudge, and the
first impression of our work is a broken file.

**No preview, "to save time".** The preview is what converts a page of
swatches into a decision. Without it colors pass without comment in the
abstract and the reaction arrives on the real document, which is the extra
round of comments this sheet exists to prevent.

**Filler in the preview.** A made-up project name and invented status lines.
One fake sentence and nothing above it is trusted. If there is no real
content yet, use the smallest true thing: the actual project name and the
actual next step.

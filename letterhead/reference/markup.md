# Document markup — the shared vocabulary every style renders

Apply the shared rules in SKILL.md first. This file says how to mark up a
document so that `styles/<slug>/style.css` can lay it out. Every style
renders the same markup in its own way: the gazette turns the head into a
masthead, consulting hangs numbers on the sections, engineering sets the
metadata as a mono rail. Mark the content up once and the style does the
composition; the document's own `<style>` only adds what this document
needs on top.

## The vocabulary

Everything sits inside `<main class="doc">`. The styles scope their rules to
`.doc` at zero extra specificity, so a rule in the document's own `<style>`
on the same element wins without `!important`.

| Markup | What it is | Use it for |
|---|---|---|
| `<header class="doc-head">` | The document head. | Exactly one, first in `main`. |
| `.brand-mark` (in the head) | The logo, drawn from the tokens (`reference/create.md` § Logo). | When the tokens carry a logo. |
| `<p class="kicker">` | A short label above a heading. | Document type above the `h1`; a section label ("Finding 1", "Stop 2") as the first child of a `section`. |
| `<h1>` | The title. | Exactly one. |
| `<p class="lede">` | The thesis: one or two sentences under the title. | Every document that has a point. |
| `<dl class="meta">` | Labeled metadata. Each field is `<div><dt>Label</dt><dd>Value</dd></div>`. | In the head, always; in the close for sign-off details. |
| `<nav class="contents" aria-label="…"><ol><li><a href="#id">` | Contents. | Documents with five or more sections. Same order as the sections. |
| `<div class="summary">` | The takeaway box: executive summary, verdict, TL;DR, readiness. Starts with `<p class="label">`. | Once, near the head. |
| `<section>` + `<h2 id>` | A section. Every `h2` opens its own `section`; `h3` stays inside it. | All content after the head. |
| `<p class="figure"><strong>78%</strong> rest of the sentence</p>` | The key figure, in the sentence that needs it. | At most one per section, only for a number the source states. |
| `<p class="verdict">` | One judgment sentence standing apart from its prose. | A recommendation or conclusion per section, not more. |
| `<p class="dropcap">` | A paragraph that opens with a drop cap, in the styles that draw one (gazette); the others set it as a plain paragraph. | Once, on the opening paragraph of the first section, and only when that paragraph starts with a letter. A paragraph starting with a digit or a quotation mark gets no class: CSS cannot see what the first character is, and a three-line "2" reads as a misprint. |
| `<div class="callout">`, `.callout.warn` | Something the reader must act on or must not miss; `warn` for risk. Starts with `<p class="label">`. | Required actions, blockers, decisions made on the reader's behalf. |
| `<dl class="status">` | A status ledger: `<div><dt>Load test</dt><dd><span class="state ok">passed</span></dd></div>`. | Status updates, checklists, audits: the state of things in one strip. |
| `<span class="state ok\|warn\|blocked\|neutral">` | A state word, colored from `--status-ok`, `-warn`, `-blocked`, `-neutral`. | In a table cell, the status ledger or a `ul.states`. Always a word ("passed", "blocked", "held"): the word carries the state, the color only repeats it, so a reader who cannot tell red from green, or prints in grey, loses nothing. |
| `<ul class="states">` | A list where every item leads with its state: `<li><span class="state ok">done</span><div>Load test at 3x peak.</div></li>`. | Done / open / blocked lists in status updates and checklists. A plain `ul` with a state inside gets a bullet and a marker on one line. |
| `<ul class="checks">` | A list of tick boxes: `<li id="…"><span class="tick" aria-hidden="true"></span><div>Condition.</div><span class="who">Sofie, by Thu 29 Oct</span></li>`. The `who` slot (owner, deadline, or both) is optional. A done item is `<li class="done">` with `<span class="tick" role="img" aria-label="done"></span>`: the style draws a check in the box, the label says it to a screen reader. | Checklists meant to be printed and ticked by hand, or read as a to-do list. The boxes print as empty squares; a state the box cannot show (blocked, waiting) goes in words as a `.state` inside the `div`. |
| `<div class="write-in">` + `<span class="line"></span>` | Fields to fill in by hand: one `<p>` per field, the label then a `line`: `<div class="write-in"><p>Signed off by <span class="line"></span></p><p>Time <span class="line"></span></p></div>`. A `line` also works on its own inside text, as a blank. | Sign-offs, times and names on printed checklists and forms. |
| `<div class="table-wrap"><table>` | A table; `class="num"` on numeric `th`/`td`. | Every table, so it scrolls on a phone instead of squeezing. |
| `<ol class="steps">` | A sequence: next steps, an agenda, a timeline, a flow. Each item is `<li><span class="when">Mon</span><div>…</div></li>`; leave out the `when` and the style numbers the step. The step the reader is at now is `<li aria-current="step">`. | Order matters and each step has a time or an owner. Mark a current step only when the source says where things stand. |
| `<ol class="recs">` | Recommendations, numbered R1, R2 by the style. Each item is `<li><div>…</div><span class="from">From finding 2</span></li>`. | Reports, audits, reviews. |
| `<div class="price">` | The price at a glance: `<p class="label">`, then a `<dl>` of `<div><dt>Item</dt><dd>Amount</dd></div>` rows ending, inside the same `<dl>`, with `<div class="total"><dt>Total</dt><dd>Amount</dd></div>`, then terms in a `<p>`. | Offers and proposals to private customers. |
| `<div class="letter">` + `<p class="from">` | A personal note to the reader by name, signed by the sender. | Only when the source names both people. |
| `<section class="ask">` | The section the document exists for: the decision requested. | Proposals, walkthroughs, anything that ends in a yes or no. |
| `<footer class="doc-close">` | The sign-off: `<p class="label">Prepared by</p>`, `<p class="from">`, optional `dl.meta`. | Deliverables that close like a letter. |

Items in `steps`, `recs`, `states` and `checks` hold one marker element
(`.when`, `.state`, `.tick`) and one `<div>` with the content (plus the
optional `.from` or `.who` after it), nothing loose beside them. Some
styles lay these items out as a grid with the marker in its own column;
loose text with a `<strong>` or a `<code>` in it falls into that grid as
separate pieces, and the step reads in fragments.

Use only what the content earns. A two-section status update has a head,
a summary and two sections; it has no contents, no figure and no close.

## Procedure

1. Write the head: kicker if the document type helps, `h1`, `lede`,
   `dl.meta` with real fields, five at most.
2. Wrap each section: `<section>`, optional kicker, `<h2 id>` with the
   stable id (`reference/create.md` step 7), content.
3. Reach for a vocabulary element only where the content has that shape:
   a figure where the source gives the number, `steps` where order matters,
   a `callout` where the reader must act.
4. Run `apply-tokens.mjs`; it adds the fonts, the tokens and the style's
   `style.css`. Write the document's own CSS after them: anything this
   document needs that the vocabulary does not cover, using `var(--*)`
   tokens only.

## Failure modes

**The crowded head.** Eight or nine fields in `dl.meta`: reviewer, scope,
standard, version, environment, distribution. In a style that sets the
metadata beside the title the rail runs far below it; in a grid the last row
wraps half-empty. Keep the head to the five fields the reader needs to place
the document (usually status, owner, audience or recipients, date, and one
the template names); the rest goes in the first section or the close.

**A div soup the style cannot see.** The document invents `.hero`,
`.tldr-box` and `.meta-grid`, so `style.css` styles none of it, and the
document comes out in the agent's own generic layout, the same in every
style. Use the vocabulary names; invent a class only for what it lacks.

**Re-styling the vocabulary.** The document's own CSS restyles `.doc-head`
or `h2` "to make it look better", and the style's signature move is gone.
The style already did the composition; add to it, do not replace it.

**State as color only.** A green dot with no word, or a row tinted red. The
reader in grey print, in the dark theme or with red-green color blindness
cannot tell the states apart. Write the state as a word in a `.state`; the
style colors it.

**Home-made tick boxes.** A printed checklist that draws its own boxes
and blank lines in the document's CSS: two kilobytes of one-off rules that
no style lays out, boxes that print as filled grey squares in one browser
and vanish in another. Use `ul.checks` and `.write-in`; the style draws
them on screen and in print.

**Labels without fields.** `dl.meta` written as bare `dt`/`dd` pairs, or as
chips with no labels. The styles lay out each `div` as one field; without
the `div` the label and value drift apart on a phone.

**Decoration as vocabulary.** A `figure` on a number the source does not
give, a `callout` around ordinary prose, every section with a `verdict`.
Each element tells the reader "this one matters"; used everywhere, none of
them does.

**Hard-coded colors and fonts in the document's CSS.** A hex value or a
named font in the document's own `<style>` survives a brand change and a
style change, so the document ends up half in one look and half in another.
Read `var(--*)` tokens only.

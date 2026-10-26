---
name: Content kit
description: Ready-to-paste texts for someone to publish: social posts and threads, an article, emails, listing copy, replies. Each text has its date, its character limit, a copy button, and what must be confirmed before it goes out.
---

# Content kit

The kit carries a layout of its own: `content-kit.css` and `content-kit.js`
next to this file. `apply-template.mjs` puts them into the document in place
of the style's `style.css`; the brand and the style still give the colors,
fonts and radii through the tokens. Add document-level CSS only for what the
markup below lacks, never to restyle it (SKILL.md, law 8).

## Use when

Someone will copy texts out of the document and publish them on given days:
a launch on social channels, an article with its posts, a customer email, a
directory listing, prepared replies. The reader's questions are "what goes
out today", "is it within the limit" and "what do I still have to check".

## Do not use when

The reader decides whether the campaign happens at all; that is a proposal
(it may link to the kit). The document reports how a campaign performed;
that is a report. It tracks where the content work stands this week; that
is a status update. A single text with no schedule, limit or check goes in
chat or in the document it belongs to.

## Build

```sh
node <skill>/scripts/apply-tokens.mjs <profile-dir> <file>
node <skill>/scripts/apply-template.mjs content-kit <file>
node <skill>/scripts/count-copy.mjs <file>
```

Write the body in the markup below, inside `<main class="doc kit">`, with
every counter as `0 / <limit>`. `count-copy.mjs` writes each counter from
its text (agents miscount by hand) and exits 2 while any text is over its
limit: shorten the text, run it again. Run it after every edit to a text;
`--check` only verifies. `example.html` next to this file is a worked kit
with every element in it (a fictional business, no tokens): read it before
writing, take its markup, never its content. Check the result with
`check-document.mjs --render` (build step 9 in reference/create.md): it
catches a click that changes the words and a page that scrolls sideways.

## Structure

1. **Head** (`header.doc-head`): `.brand-mark` when the tokens carry a
   logo, `p.kicker` ("Content kit"), `h1` with the kit's name in a few
   words, `p.lede` with what the kit holds and when it runs, `dl.meta` with
   five fields at most: Status, Owner, Channels, Runs (first to last date),
   Updated. No "Prepared for" when the reader is the owner.
2. **Contents** (`nav.contents > ol` of links), right after the head.
3. **Before you publish** (one `section.gate`, first after the contents: it
   gates publishing). Open decisions as `ul.checks`, each `div` holding the
   question and `<span class="dflt">` with what happens if nobody answers;
   the `.who` slot names who answers and by when. Then `h3` "Remember when
   publishing" with a short `ul.states`. Then the settled points folded in
   `details.closed`. Risks and decisions are this one list, never two
   sections.
4. **Schedule:** one table in `.table-wrap`: date, piece (a link to its
   `h2`), format, goal. Once. No `ol.steps` timeline beside it.
5. **Pieces:** one `section.piece` per piece, in publication order. It opens
   with `p.when`: `<span class="n">2</span><time datetime="2026-11-04">Wed 4
   Nov</time><span class="fmt">X thread</span>`; the number is the order of
   publication, the same as in the schedule. Then `h2[id]`, `p.note` (one
   line: where it runs and why), the copy blocks (main text, alternatives,
   first reply), `div.asset` per image or video brief (`p.label`, then what
   to make, size included), and `details.verify` last.
6. **Sources:** one list at the end; each piece's `details.verify` names
   which source backs which claim.

## Copy blocks

```html
<div class="copy" id="thread-post-1" data-limit="280" data-count="x">
  <div class="copy-bar">
    <p class="copy-label">Post 1 of 3</p>
    <span class="count">0 / 280</span>
    <button type="button" class="copy-btn" data-done="Copied" data-fail="Selected: press Ctrl+C" hidden>Copy</button>
  </div>
  <pre>The text, exactly as it is published.</pre>
</div>
```

- **`id`** slugged from the piece and the block; the schedule and comments
  point at it. **`data-limit`** is the channel's limit as the author knows
  it; leave it out when there is none (the counter keeps its unit word:
  `0 characters`). **`data-count="x"`** counts the way X does: every link
  23, CJK and emoji 2. Without it a character is a Unicode code point.
- **The text** sits in `pre`, nothing else inside it, no indentation of its
  own. Trailing blank lines are not part of it.
- **The button** is in the HTML with `hidden`; the script shows it. Its
  label and `data-done` / `data-fail` are words in the document's language.
- **`.copy.confirm`**: a variant that must not go out before a check. The
  CSS draws a dashed border in the warn color; the bar adds
  `<span class="state warn">confirm first</span>` and a `p.copy-note`
  between the bar and the text says what to confirm. A legend, if the kit
  has one, names only these two marks.
- **`.copy.rich`**: an article body. Two buttons: `data-as="rich"` copies
  formatted text (headings, lists) for an editor, the plain one copies the
  text as written. Write the body so the formatting can be read from it:
  blocks separated by an empty line; a block of one line, under 80
  characters, ending without `.`, `,`, `:`, `;`, `!` or `…` becomes a
  heading; a block whose every line starts with `- ` becomes a bullet list,
  `1. ` a numbered list; anything else is a paragraph. Title and subtitle
  are separate plain blocks above it.
- **`p.copy-status[role="status"]`**, once, last in `main`:
  `<span class="ok">Copied.</span><span class="fail">Copy blocked: the text
  is selected.</span>`. The script shows one of them for a screen reader.

The script copies, shows feedback through an attribute and CSS, and opens
folded detail for print. It never writes text into the document and never
writes a counter: a script that swaps "Copy" for "Copied!" changes the
words a comment is anchored to.

## Hierarchy contract

The gate is the strongest block after the head: nothing goes out until it
is read. Within a piece the date badge leads, then the title, then the
texts; the texts are the loudest elements of the page after the headings.
Verification is folded and quiet. The head is a working head: a title a
little larger than the section headings, never a display-size opener.

## Mobile contract

First two phone screens: title, lede, metadata, the contents, the start of
the gate. Copy blocks wrap their text (`pre-wrap`, long links break), so
nothing scrolls sideways at 390 px; only the schedule table scrolls inside
its `.table-wrap`. A `.state` is a word or two; a source or date goes beside
it as plain text.

## Review contract

Stable ids per SKILL.md § Review-ready contract on every `h2` and `h3` and on
every copy block and decision. Counters, button labels and the status
words are in the HTML from the start and never change, so a comment quoting
a text finds it in the next version. Renumbering pieces after a schedule
change keeps their ids.

## Failure modes

**Numbered by topic.** Post 3 goes out first, and on publish day the reader
hunts for the card. Pieces follow the publication order and carry that
number and their date.

**Invented components.** `.post`, `.cl`, `.kb` and `.var` that no layout
draws, and a legend promising "dashed yellow frame = variant, blue frame =
optional" that the CSS never draws. Use `.copy` and `.copy.confirm`; a
legend names only what is drawn.

**Counters by hand.** "275 / 280" typed by the agent over a 291-character
post. Run `count-copy.mjs`; the script in the page never counts.

**The schedule twice.** A `steps` timeline and a table with the same dates
drift apart by the next version. One table.

**Risks and decisions as two sections** covering the same three items, so
the reader answers twice. One gate: open, remember, closed.

**Sources in a state chip.** A `.state` holding a whole citation pushes the
phone page sideways. The chip says "checked"; the source is plain text.

**Verification lists in every card.** Five unfolded lines of evidence per
post bury the texts. `details.verify`, folded, prints open.

**Prepared for the owner.** "Prepared for: Noor" on Noor's own kit. The
meta carries what the reader needs on publish day.

**A launch-page title.** A 76 px title eats the first phone screen of a
document opened every morning to copy from. Working head, small title.

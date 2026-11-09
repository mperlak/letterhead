---
name: Agreement
description: A contract between named parties, from a supplied text or written with the user: numbered clauses, signatures and annexes, for negotiation in comments and then for signing on paper.
---

# Agreement

The agreement carries a layout of its own: `agreement.css` next to this
file. `apply-template.mjs` puts it into the document in place of the style's
`style.css`. A contract looks the same in every style; the brand and the
style give it colors and fonts through the tokens.

## Use when

Two or more named parties will sign a text with numbered provisions: a
service or cooperation agreement, an NDA, a data processing agreement, an
amendment, a statement of work written as a contract. The draft goes through
rounds of comments, then gets printed and signed.

## Do not use when

The reader approves an offer and nothing is signed yet; that is a proposal.
The document summarizes a contract already in force; that is a report. Nobody
signs it (website terms, an internal policy); it has no parties and no
signature block to lay out.

## Build

```sh
node <skill>/scripts/apply-tokens.mjs <profile-dir> <file>
node <skill>/scripts/apply-template.mjs agreement <file>
```

Write the body inside `<main class="doc agreement">` in the markup of
`reference/markup.md`, including its Agreement section. Check the result
with `check-document.mjs --render`.

## Structure

With a source, the document has the source's structure: what the source has
stays where it was, and no heading is added. Without one, use this order.

1. **Header:** the title as the `h1`, the line that says where and when the
   agreement is made as the `lede`, and in a draft a `dl.meta` with the
   status, the date and any note to reviewers.
2. **Parties:** plain paragraphs under the head.
3. **Numbered sections:** each is a `section` with its number as a
   `kicker` ("§ 1") and its title in the `h2`. Clauses go in `ol.clauses`,
   with the number as literal text; lettered points are an `ol.clauses`
   inside the clause. A paragraph that continues a clause stays in its `div`;
   a provision with no number is a plain `p`.
4. **List of annexes,** when there are any, and **signatures:** `.signatures`,
   one block per party, inside the last numbered section after its clauses.
   A separate signature page is a `section.annex`.
5. **Annexes:** each is a `section.annex` that starts a new page, with its
   label as the `kicker` and its title in the `h2`. An annex the parties
   sign separately has its own `.signatures`.

## Creation guidance

**From a text** (a Word file, a PDF, a lawyer's draft): every word, number
and punctuation mark stays, in the source's order. The "content given
verbatim" rule in `reference/create.md` covers the whole document. If something
looks wrong (a reference to a clause that does not exist, a term used before
it is defined), tell the user in chat and leave the text alone.

**Written with the user** (no source file): write from what the user decided:
the parties, scope, price, terms. A term nobody decided is asked about or left
open in the text, never chosen quietly. List in chat every clause you proposed
yourself, so the user can see which ones came from nobody's decision.

Once the user accepts a version, its wording is the source: later rounds change
only the words the user asks to change. The brand's voice never touches it.

A blank to fill in is a `.line` in the sentence, with `role="img"` and an
`aria-label` naming what goes there; without the label a screen reader
reads "at a rate of per hour" and the blank is gone. Bracketed text with words
in it ("[Company Name]") stays as the source has it; the checker reports it as
info, not an error.

No logo by default. A contract belongs to both parties, and one party's
logo on it reads as a form the other is told to sign. Use one only when the
document is the sender's own standard contract; name the choice in the
shape gate. With no profile, take colors and fonts from `boardroom` or
`public-sector`.

The signing copy is a separate step, done only when the user asks, in a new
file so the draft and its comments stay as they were. Remove the `dl.meta`.
Then list for the user every `.line`, bracketed field and open note still in
the text, and ask which ones are meant to be filled in by hand.

The report back says that no lawyer has reviewed the terms, and which clauses
the agent wrote. A document that looks finished reads as checked.

## Hierarchy contract

The clauses are the document. Numbers hang in their own column so a reader
can find "4.2" by scanning the margin; the text is calm and even. Nothing
competes with it: no `figure`, `verdict`, `callout`, `summary`, drop cap or
`contents`. Each of them either adds words the parties did not write or
makes one obligation look more binding than the next. No style's signature
move applies; the layout is the composition.

The printed page is the copy of record: A4, or `@page { size: letter; }` in
the document's own CSS for a US contract. Every page carries its number and
the total at the foot, so a missing or swapped page shows. Check the print
preview: annexes start on new pages, headings stay with their first clause,
and the signatures stay on a page that carries contract text.

## Mobile contract

First phone screen: title, the place and date line, status, and the start
of the parties. Clause numbers stay beside the text, long clauses wrap
under their own text, and lettered points indent one step. Signature blocks
stack, one party per block.

## Review contract

Stable ids per SKILL.md § Review-ready contract: every `h2` slugged from its
title, with the `§` number left out. Every clause and lettered point also
has an id: the number it had in the first version (`p1-4`, `z1-1` in an
annex). That id never changes, even when the clause becomes 1.5. A new
clause gets an id no earlier version used, and the id of a deleted clause is
not used again. Do not slug it from the text: negotiation changes the text,
and the id would change with it.

Comments on selected text anchor to the quoted words, so a new version edits
the file in place and changes only the words the round agreed.

Before sharing with the other party, send a clean copy without internal
comments. A note like "we can give way on 7.4" on a shared link is read by
the people it was about.

## Failure modes

**Helpful rewording.** A clause reads better after the polish and now means
something else: "within" became "by", "under pain of nullity" fell out. The
wording is not the agent's to improve.

**Invented clause.** The document gains a six-month warranty or a
confidentiality section because agreements usually have one, and nobody agreed
to it. Say what looks missing in chat.

**Stale reference.** A new clause moves 1.4 to 1.5, and "at the rate in
clause 1.4" now points at the wrong obligation. After any renumbering, check
every clause reference in the document and its annexes, and list the changed
ones for the user.

**Numbers from CSS.** Counters draw the number, and it vanishes when the text
is pasted into Word or quoted in an email. Numbers are text.

**Draft on the signed paper.** "Status: draft for comments" printed above the
signatures. The signing copy has no review metadata.

**Forgotten blank.** A signing copy goes out with the hourly rate still
empty. The list of remaining blanks exists to stop this.

**Signatures cut off from the text.** A last page with signatures and nothing
else, where the source did not put them on their own page, could be attached
to any text. Chromium does not always keep them with the last clause; if the
print preview shows this, add `#<last-clause-id> { break-before: page; }` to
the document's own CSS.

---
name: Status update
description: A recurring progress report for a project stakeholder, with a TL;DR, what moved, what is blocked, and what needs a decision.
---

# Status update

## Use when

Someone who is not doing the work needs to know where it stands: a client, a
manager, a team channel. The document recurs (weekly, per sprint, per
milestone), and the reader's real question is "is anything blocked on me?"

This is a recurring document. The same project produces one every period,
which is exactly why the review contract matters: reviewers comment on this
week's update, and next week's version must not orphan those threads.

## Do not use when

The reader must approve future work; that is an implementation plan or a
proposal. The update would be the first and only one, summarizing a finished
effort; that is a project recap. Nothing happened this period; say that in
one line in chat instead of shipping a hollow document.

## Structure

1. **Header:** project, period covered, owner, date. Labeled fields at the
   title, per the review contract.
2. **TL;DR, three sentences maximum.** Overall state, the single most
   important development, and whether anything needs the reader. Written
   last, placed first.
3. **Done:** what shipped or finished this period. Concrete outcomes, not
   activities ("returns portal live behind flag", not "worked on portal").
4. **In progress:** what is moving and where it stands. Short.
5. **Blocked / decisions needed.** The section the reader actually opens
   the document for. Each item names what is stuck, who can unstick it, and
   what happens if nobody does. Never bury this below the fold of the first
   phone screen if anything in it is addressed to the reader; when that
   happens, the TL;DR points at it explicitly.
6. **Next:** what the coming period should produce.

## Hierarchy contract

TL;DR is visually the strongest block after the title. Done / In progress /
Blocked / Next read as a stable rhythm the recipient learns across weeks;
keep the section order identical between issues of the same update. State
markers (done, blocked) are compact and textual; the update is a letter,
not a dashboard.

## Mobile contract

First phone screen: title, metadata, complete TL;DR. Second screen: the
blocked/decisions section or the top of Done, whichever the TL;DR pointed
at. Lists stay lists; no multi-column layouts that interleave when stacked.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with one addition for
recurring documents: section ids stay identical across issues (`tl-dr`,
`done`, `in-progress`, `blocked-decisions-needed`, `next`), so a reader's
comment thread on "blocked" carries meaning week over week. Items inside
the blocked section are individually anchorable (one element per item).
Each issue is a new version of the same document, not a new document, so
the feedback history stays in one place.

## Failure modes

**Two screens of scroll.** An update longer than roughly two phone screens
stops being read weekly. Cut activities, keep outcomes; the reader can
always ask.

**KPI tiles without data.** Four big numbers with no source and no
comparison. If the project has real metrics, one small labeled row; if not,
none.

**The hidden ask.** "Also, we may need to discuss the contract scope" as
the last sentence of In progress. Anything that needs the reader goes in
Blocked / decisions needed, and the TL;DR says it is there.

**Activity theater.** Listing meetings held and hours spent. The reader
pays for outcomes; the update reports outcomes.

**Rhythm drift.** Reordering or renaming sections between issues. The
recipient reads this document on autopilot by week three; moving Blocked
below Next breaks the one habit the format exists to build.

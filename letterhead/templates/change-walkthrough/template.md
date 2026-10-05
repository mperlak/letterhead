---
name: Change walkthrough
description: A guided tour of a delivered change for the person who must accept it: what changed, why, what to look at, and what to verify before saying yes.
---

# Change walkthrough

## Use when

Work is delivered and someone who did not do it must review or accept it:
a client receiving a milestone, a stakeholder approving a feature before
release, a teammate reviewing a large change outside their area. The
document walks the reader through the change in their language, points at
what deserves attention, and gives them a concrete verification path.
This is the natural companion to agent-built work: the agent (or its
operator) explains what it did, and the reader's comments and answers come
back before the work moves forward.

## Do not use when

The reader wants line-by-line code review in their own tooling; the
walkthrough complements, never replaces, the diff. The change has not
happened yet; that is a proposal or an implementation plan. The audience
is end users of a released version; that is release notes.

## Structure

1. **Header:** the change as the title, labeled metadata (delivered by,
   for, date, source reference: branch, version, or environment where the
   change can be seen).
2. **What changed and why, in the reader's terms:** two or three
   sentences. The business reason first, the mechanism second.
3. **The tour.** One section per meaningful part of the change, in the
   order the reader should look at them, not the order they were built.
   Each stop: what this part does now, what it did before when the
   contrast matters, and where to see it (screen, URL, file, or flow).
   Screenshots or snippets appear when the reader cannot otherwise see
   the thing being described.
4. **What deserves your attention:** the honest section. Decisions made
   on the reader's behalf, tradeoffs, places where the author wants a
   second opinion, anything that surprised the author while building.
   Each item is a question or a flag the reader can answer or accept.
5. **How to verify:** a concrete path the reader can walk: steps to try,
   what they should see, what would be wrong. Written so a non-author can
   execute it without help.
6. **What happens on acceptance:** what the yes triggers (merge, deploy,
   invoice, next milestone) and where remaining feedback should go if it
   is not a yes.

## Creation guidance

Order the tour by reader interest: the visible or riskiest change first.
The attention section is the document's honesty budget; a walkthrough with
an empty one reads as sales, not engineering. When the change has a diff,
link or reference it near the header for readers who want the source;
never paste the whole diff into the document.

## Hierarchy contract

What-changed-and-why is the strongest block after the title. Tour stops
have identical internal anatomy so the reader learns the rhythm at stop
one. The attention section is visually distinct but calm; flags, not
alarms. The verification path is typeset as numbered steps, the most
carefully set element after the tour.

## Mobile contract

First two phone screens: title, metadata, complete what-changed-and-why,
and the first tour stop. Screenshots scale to width without horizontal
scroll; verification steps keep step number and instruction together.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with the walkthrough
addition: every tour stop and every attention item is individually
anchorable, ids slugged from content, because acceptance conversations
happen per stop and per flag. When feedback produces a revised delivery,
the new walkthrough is a new version of the same document: stops that
survived keep their ids and their comment threads.

## Failure modes

**Diff dump.** Pasting the code changes and calling it a walkthrough. The
reader who wanted the diff has the diff; this document exists for the
reader who does not.

**Build-order tour.** Stops ordered by when the author built them.
The reader's risk and interest set the order.

**Empty attention section.** No tradeoffs, no decisions, nothing to flag,
in a change of any real size, means the section was skipped, not that the
change was perfect. The reader's trust drops accordingly.

**Unexecutable verification.** "Test the flow and confirm it works."
Which flow, starting where, seeing what. If the author cannot write the
steps, the reader cannot walk them.

**Acceptance limbo.** The document never says what a yes causes or where
a no goes. The reader finishes the tour and does not know what to do;
the whole document existed for that moment.

---
name: Postmortem
description: The record of an incident after it is over: what happened and when, why, what it cost, and the actions that keep it from happening again.
---

# Postmortem

## Use when

An incident is resolved and the organization needs the durable record: a
timeline of what happened, the causal chain, honest impact, and action
items with owners. Readers are mixed: the team that lived it, adjacent
teams who will hit the same class of problem, and management who needs
impact and follow-through. A postmortem often starts life as a running
incident page and matures into the final version; that evolution is
versions of one document, not new documents.

## Do not use when

The incident is still open; a running incident page is a different, live
register, and this template documents the aftermath. Nothing actually
broke and the document assesses risk; that is an audit or a report. The
goal is to assign blame; then the document should not be written until the
goal changes — blameless is a structural property here, not a tone.

## Structure

1. **Header:** incident name as the title, labeled metadata (severity,
   duration, date, services or areas affected, status of this document:
   draft / reviewed / final).
2. **Summary:** what broke, for how long, who was affected, and the one
   sentence version of why. Written for the reader who was not there.
3. **Impact:** the honest numbers: users or orders affected, revenue if
   known, support load, data integrity. Real figures from the incident's
   record; unknown is written as unknown.
4. **Timeline.** Timestamped entries from first signal to resolution.
   Each entry: time, what happened or what was done, who or what did it.
   Detection time, escalation time, and mitigation time are called out so
   the response itself can be judged.
5. **Why it happened:** the causal chain, as deep as the evidence goes.
   Distinguish the trigger (what set it off) from the conditions (what
   allowed it to become an incident). Systems and processes fail here,
   not people.
6. **What went well / what went badly** in the response itself. Short and
   concrete; this is where the response process improves.
7. **Action items:** each with owner, priority, and a due date or a
   deadline class. This section is the document's contract with the
   future; everything above it is context for these rows.

## Creation guidance

Everything comes from the incident's actual record: alerts, chat logs,
deploy history, dashboards. Timestamps are real or absent. If the causal
chain has an unproven link, mark the confidence rather than smoothing the
story. Name systems and roles, not individuals, in causal statements.

## Hierarchy contract

The summary and impact are the strongest blocks after the title. The
timeline is the evidentiary core and gets the most careful typesetting:
times in mono, aligned, scannable. Action items close the document as a
compact table or list, visually distinct enough that a reader can jump
straight to them.

## Mobile contract

First two phone screens: title, metadata, complete summary, and the top of
impact. Timeline entries keep time and event on one visual line where
possible; when wrapping, the event text indents under itself, never under
the timestamp.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with two additions:
timeline entries are individually anchorable (reviewers correct timelines
more than any other section), and each action item is its own anchor
point with an id slugged from the action, not its number. The
incident-page-to-postmortem evolution happens as versions of one document,
so the discussion from the live phase stays attached.

## Failure modes

**Blame in causal clothing.** "The engineer failed to check X" is blame.
"Nothing in the deploy pipeline checks X" is a cause. If a sentence needs
a person's name to work, it is describing the wrong layer.

**Timeline gaps at the interesting part.** Dense timestamps up to the
escalation, then "the issue was resolved". The gap is usually where the
lesson lives; reconstruct it or mark it as unreconstructed.

**Impact minimization.** "Some users may have experienced issues." The
reader can handle the real number; they cannot handle discovering it
elsewhere.

**Action-item theater.** Ten vague items with no owners that everyone
knows will not happen. Three owned, dated, specific items beat ten
wishes.

**Root-cause singular.** Forcing one root cause when the evidence shows a
chain of conditions. The template asks why it happened, not for one
culprit noun.

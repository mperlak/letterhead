---
name: Implementation plan
description: An execution-ready plan for a technical or product change, with scope, phases, acceptance criteria, risks, and the decisions still open.
---

# Implementation plan

## Use when

The reader needs to approve or execute a concrete piece of work: what will
be built, in what order, what done looks like per phase, and what could go
wrong. Pick it when decisions exist and the job is to turn them into steps
a team (or an agent) can run.

## Do not use when

The work is not yet decided; that is a proposal, not a plan. The document
reports on work already in motion; that is a status update. The main object
is calendar sequencing across teams; that wants a roadmap, which this
skill does not ship yet — say so and offer the closest structure.

## Structure

1. **Header:** title, one-line subtitle saying what changes, labeled
   metadata (status, owner, audience, date, target release if one exists).
2. **Summary before detail:** two or three sentences of what we are doing
   and why, readable by someone who stops there. The reader who opens this
   on a phone between meetings gets the whole story from this section.
3. **What is in and what is out:** what the work covers, what it
   deliberately leaves out, and what it assumes. Naming the non-goals keeps
   the executor from gold-plating.
4. **Phases**, ordered by dependency. Each phase carries its scope (what
   surfaces or systems it touches), its acceptance criteria (the observable
   state that means the phase is done), and what it depends on. Acceptance
   criteria are per phase, not one pile at the end.
5. **Risks**, each with a trigger and a response. A risk without a response
   is an open question and belongs in the next section instead.
6. **Decisions needed / open questions:** what must be answered, by whom,
   and whether it blocks a phase. Only when real decision points exist;
   see the Review contract.
7. **Rollout and rollback:** how the change reaches users and how it comes
   back out if it must.

## Hierarchy contract

The summary is the largest reading moment after the title. Phases are the
working core; each phase heading names the outcome, not the activity
("Orders sync in real time", not "Backend work"). Status and risk labels
stay compact text, not badge walls. Tables serve comparison (risk matrix,
decision list); sequencing stays a numbered flow.

## Mobile contract

First two phone screens: title, metadata, the full summary, and the top of
the scope boundary. Phase tables may collapse to structured lists when
column comparison is not the reader's job. A risk row keeps its trigger and
response together when it wraps.

## Review contract

Stable ids on every section heading, slugged from text, kept across
versions (SKILL.md § Review-ready contract). The decisions-needed section
is where reviewer answers land; when it exists, each decision is its own
anchor point (one list item or row per decision) so a comment can attach to
exactly one question. When a new version addresses feedback, phases keep
their ids even if renamed.

## Failure modes

**Fake gantt.** A timeline visual with invented dates. If the source has no
dates, the plan has phases and dependencies, not a calendar.

**Status theater.** Progress bars, percent-complete meters, or KPI tiles
with no measured data behind them. A plan describes intent; it has no
progress to show yet.

**Bold-prose hierarchy.** Whole paragraphs bolded to look structured.
Hierarchy comes from headings, order, and section rhythm, not from weight
applied to running text.

**Todo-list phases.** "Implement backend, update UI, add tests" cannot be
resumed by another agent or reviewed by a client. Each phase names its
target surface, expected outcome, and acceptance criteria.

**Buried ask.** The plan needs three decisions from the reader and they sit
in paragraph nine. Decisions the reader must make appear as their own
section, and the summary says the plan is waiting on them.

---
name: Spec
description: A specification a client or domain expert can verify: business context, scope, step-by-step flows, per-module requirements, integrations, and the decisions still open.
---

# Spec

## Use when

The reader must confirm that the planned system matches their reality before
anyone builds it: a client reviewing an integration spec, a domain expert
checking process flows, a vendor confirming interface details. The document's
job is to be answerable; most sections exist so the reader can say "yes,
that's how it works here" or "no, step 3 is wrong".

## Do not use when

The work is already decided and the reader needs execution order; that is an
implementation plan. The reader needs to choose whether to do the work at
all; that is a proposal. The document describes one API surface in detail;
a reference-style document (like the webhook fixture) is closer, and this
skill does not ship that template yet — say so and adapt spec's structure.

## Structure

1. **Header:** title, one-line subtitle naming the system and the parties,
   labeled metadata (status, owner, audience, date, version of the spec).
2. **Business context:** why this exists, in the reader's language. What
   happens today, what hurts, what the change makes possible. No technical
   vocabulary yet; the domain expert must recognize their own workday here.
3. **Scope:** what the system covers, what it explicitly does not, and the
   assumptions the spec rests on. Out-of-scope items name where they went
   (another phase, another document) when that is known.
4. **Flows, step by step.** The heart of the spec. Each flow is a numbered
   sequence of concrete steps: who or what acts, what happens, what the
   next actor sees. One flow per scenario (happy path first, then the
   variants that matter). Steps are anchor points; readers comment on the
   exact step that is wrong.
5. **Requirements per module.** For each system area touched: what it must
   do, stated as verifiable behavior, not implementation. Group by module
   so each owner can review their own section in isolation.
6. **Integrations:** each external system touched, with direction of data
   flow, trigger, and format at the level the reader can verify. Detail
   payloads belong in a separate reference document; link or name it.
7. **Open decisions:** the questions only the reader can answer, each one
   its own anchor point, with what it blocks. In a spec this section is
   usually the point of the review round, so the header or lead mentions
   it when it is non-empty.

## Creation guidance

Write flows from the source material's actual scenarios; never invent a
variant to make the spec look thorough. When the source describes a current
(as-is) process and a future (to-be) process, keep them visually distinct;
mixing tenses inside one flow is how specs get misread. Tables serve field
mappings and module-requirement lists; flows stay numbered steps.

## Hierarchy contract

Business context and flows are the reading core. Flow steps are the most
carefully typeset element on the page: numbered, one action per step,
scannable. Module sections have identical internal structure so a reviewer
learns the rhythm once. Open decisions are visually distinct without being
an alarm; the reader should end there.

## Mobile contract

First two phone screens: title, metadata, and the business context whole or
nearly whole. Flows keep number, actor, and action together per step when
wrapping. Field-mapping tables scroll inside their own container instead of
reflowing.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with one addition: every
flow gets its own heading and id, and each open decision is individually
anchorable (one element per decision). Specs live through many review
rounds by nature; module sections keep their ids across versions even when
requirements inside them change wholesale.

## Failure modes

**Spec-as-plan.** Sequencing, estimates, and phase gates belong in an
implementation plan. A spec says what must be true, not when work happens.

**Unverifiable requirements.** "The module handles errors gracefully"
cannot be confirmed or denied by the reader. Each requirement names
observable behavior ("a rejected line returns a reason code the operator
sees").

**Invented flows.** A variant scenario the source never mentioned, added
for completeness. If a variant seems to matter but the source is silent,
it goes into open decisions as a question, not into flows as fiction.

**Technical opening.** A business reader who meets protocol names in the
first paragraph stops reading, and the spec loses the one person who can
verify it. Technology arrives no earlier than the integrations section.

**Empty ritual sections.** No integrations? Drop the section. No open
decisions? Drop it and say in the lead that the spec is ready to confirm.

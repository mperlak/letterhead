---
name: Checklist
description: A task-based document with owners and sign-offs: everything that must be true before (or during, or after) an event, checkable item by item.
---

# Checklist

## Use when

An event has conditions: a go-live, a launch, a migration window, an
onboarding, a periodic operational review. The reader needs to see every
condition, who owns it, and its current state, and the group needs one
place to confirm readiness. Checklists live through review rounds: items
get checked, questioned, and signed off between versions.

## Do not use when

The items are phases of work with acceptance criteria; that is an
implementation plan. The list reports what already happened; that is a
status update or a project recap. The items have no owner and no event
they gate; that is a notes file, not a document worth a reader's time.

## Structure

1. **Header:** the event as the title, labeled metadata (event date or
   window, owner of the checklist, approvers, status: on track / at risk /
   ready).
2. **Readiness line:** one sentence stating current readiness and the
   count (N of M items done, N blocked). The reader who stops here knows
   whether the date holds.
3. **Sections by phase or theme** (before / during / after, or by team).
   Each item carries: the condition stated as a verifiable fact ("staging
   mirrors production item master", not "prepare staging"), the owner, and
   its state. Done, open, and blocked read differently at a glance, by
   words and marks, never by color alone.
4. **Blocked items detail** (when any exist): what each blocked item
   waits on, who can unblock it, and what slips if nobody does.
5. **Sign-offs:** the named approvers and their state (approved, pending,
   with what condition). This section is where reviewer answers land.

A checklist that will be printed and ticked by hand puts its items in
`ul.checks` (a tick box, the condition, the owner in `.who`) and its
sign-off fields in `.write-in` (`reference/markup.md`); the style draws
the boxes and lines. One read on screen as a status list uses
`ul.states` instead.

## Creation guidance

Items come from the source (runbooks, plans, prior checklists), never
invented to look thorough. States come from the source too: nothing is
pre-checked as done without a basis. If the source has a rollback plan or
an escalation path for the event, link or name it near the header rather
than duplicating it.

## Hierarchy contract

The readiness line is the strongest block after the title. Items are the
working core: one condition per item, owner visible without hovering,
generous hit area between items so the eye can travel the list. Section
headers group; they do not decorate. A checklist is furniture, built for
repeated scanning, not for a first impression.

## Mobile contract

First phone screen: title, metadata, readiness line, and the first items.
An item's mark, condition, and owner stay together when wrapping. Long
condition text wraps under itself, never under the mark.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with the checklist
addition: every item is individually anchorable, with an id slugged from
the condition text, not the item number ("staging-mirrors-item-master",
not "item-7"), because items get inserted and reordered between rounds.
New versions keep the ids of surviving items; a checked-off item keeps
its id and its comment history. Sign-off entries are anchorable per
approver.

## Failure modes

**Vague items.** "Prepare the environment" cannot be verified or signed
off. Each item is a fact that is either true or not.

**Ownerless items.** An item nobody owns is a wish. Every item names one
owner; "both teams" is not an owner.

**Pre-checked optimism.** Items marked done because they are probably
done. A checklist that lies once is never trusted again; state follows
evidence.

**Color-only states.** Green and red dots with no words fail on phones in
sunlight, in printouts, and for colorblind readers. Words carry the state;
marks assist.

**The eternal checklist.** Items that survive event after event without
ever being checked. If an item has been open across three versions,
it is either blocked (say so, with what it waits on) or it is not a real
condition (remove it).

---
name: Meeting notes
description: What a meeting decided and who does what by when, sent to the people in it: decisions, action items with owners and dates, what we need from you, short notes per topic, the next meeting.
---

# Meeting notes

## Use when

A meeting happened (a client call, a weekly check-in, a workshop) and the
people in it, plus the people who missed it, need the outcome in writing:
what was decided, who does what by when, and what is still waiting on an
answer. The reader's questions are "what did we agree" and "what is on me".

Meeting notes are a record the reader will hold you to. A decision written
down here is the version both sides quote next week, so it has to say
exactly what was decided, no more.

## Do not use when

The source is a project's progress over a period, not one meeting; that is
a status update. The meeting only listed conditions for an event that
people will tick off; that is a checklist. Nothing was decided and nobody
took anything on; say so in one line in chat instead of shipping a hollow
document. The user wants a transcript or a summary of a talk; that is not
what this template makes.

## Structure

1. **Header:** the meeting as the title, in a few words (what it was
   about, not "Weekly call"; the outcome goes in the summary), labeled
   metadata: date, time and place in one field, who attended from each
   side as separate fields, who was absent, who took the notes. Fields
   hold names, with a role word at most; why someone was absent or joined
   late goes in the discussion notes. The lede is the meeting's purpose in
   one line.
2. **Summary, three sentences maximum.** The outcome that matters most, how
   many decisions and action items, and whether anything waits on the
   reader. Written last, placed first.
3. **Decisions.** Each decision is one sentence that stands alone ("Price
   freeze runs Tue 27 Oct 06:00 to Mon 2 Nov 12:00"), with who made it.
   Only what the meeting actually settled; a topic that was discussed and
   left open is an open question, not a decision. A plain `ul`, one `li`
   with an id per decision, the name at the end in `<em>`.
4. **What we need from you** (when anything waits on the reader): each open
   question or request names what is needed, from whom, by when, and what
   slips without it. Put it in a `callout`. This is the section a client
   opens the notes for; it comes before the action items, and the summary
   points at it.
5. **Action items.** Every item is a task, an owner and a due date. Mark
   them up as `ul.checks`: the task in the `div`, owner and date in the
   `.who` slot ("Karin Holm, by Wed 28 Oct"). An item carried over from the
   previous meeting says so in words. A table is the wrong shape here: on a
   phone it scrolls sideways and hides the owner and date columns, which
   are the point of the item; `ul.checks` keeps task, owner and date
   together in every style, prints as boxes to tick, and gives each item
   its own id.
6. **Discussion notes,** one `h3` per agenda topic, two to four sentences
   or a short list each: what was said that the decisions and action items
   do not already carry (a figure someone reported, the reason behind a
   decision, an option that was dropped). Not who said what in which
   order.
7. **Next meeting:** date, time, place, and what it will cover, in one or
   two lines.

## Creation guidance

Everything comes from the source: names, roles, decisions, dates. An
attendee the notes do not name is not added; a decision the notes do not
record is not inferred from the discussion. An action item whose owner or
date the source does not give keeps the gap visible ("Owner: not agreed",
"date not set") and the gap goes into What we need from you or the
summary, so someone fills it. "ASAP" and "next week" are not dates: turn
them into a date only when the source gives the meeting date to count
from, and say so.

Who wrote the notes decides the voice. Notes from a consultant to a client
say "we" for the consultant's side and name the client's people; the
client's asks are addressed to them directly.

## Hierarchy contract

The summary is the strongest block after the title; decisions come next
and read as short separate statements, not a paragraph. What we need from
you carries the reader's name or team in its label, so it reads as
addressed. Action items are the working core: owner and date visible on
every item without reading the task text. Discussion notes are visibly
secondary: smaller in weight, after everything the reader acts on.

## Mobile contract

First phone screen: title, date, attendees, the complete summary. Second
screen: decisions and the start of What we need from you. An action item's
box, task, owner and date stay together when wrapping; the owner and date
drop under the task, never into a column off to the side. Attendee lists
wrap as text inside their field.

## Review contract

Stable ids per SKILL.md § Review-ready contract. Section ids stay the same
across a series of meetings (`decisions`, `what-we-need-from-you`,
`action-items`, `discussion-notes`, `next-meeting`), so readers learn the
shape. Each decision and each action
item is its own element with an id slugged from its text
("lower-dns-ttl-to-300-s", not "action-4"): a client disputes one decision
or one date, and the comment has to land on that item. An action item
carried into the next meeting's notes keeps its id. A correction to the
notes ("that is not what we decided") is a new version of the same
document, not a new document, so the thread stays with the item.

## Failure modes

**The transcript dump.** Paragraphs of who said what, in the order it was
said, with the decisions somewhere inside. The reader wanted the outcome;
the discussion notes exist only for what the outcome does not carry.

**Action items without an owner or a date.** "Look into the redirects" is
a wish. Every item names one person and one date, or shows plainly that
they are missing; "the team" and "both sides" are not owners.

**Invented attendees and decisions.** A name added because meetings
usually have one, a decision rounded up from a discussion that ended
open. Meeting notes are quoted back as the record; one invented line
and the client stops trusting the rest.

**The buried ask.** The one thing the client must answer sits in the
fourth discussion topic. Anything that waits on the reader goes in What
we need from you, and the summary says it is there.

**Decisions as discussion.** "We talked about the price freeze and
generally felt option A was better." Either it was decided (one sentence,
who decided) or it is an open question; the notes say which.

**The crowded header.** Seven metadata fields written as sentences: roles,
reasons for absence, the next meeting's agenda. On a phone they fill the
first two screens and the summary starts on the third. Names in the
fields; the reasons go in the notes, the next meeting in its section.

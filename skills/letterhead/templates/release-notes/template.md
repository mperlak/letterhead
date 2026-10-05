---
name: Release notes
description: What changed in a release, for the people who use or depend on the thing: highlights, changes by area, breaking changes with migration steps, known issues.
---

# Release notes

## Use when

A version shipped and its users, integrators, or stakeholders need to know
what changed and what they must do about it. The reader's questions, in
order: "does anything break for me", "what is new", "what should I try".

## Do not use when

The audience is the internal team tracking progress; that is a status
update. The release closes a whole project; that is a project recap. The
change list is one line; send the line, not a document.

## Structure

1. **Header:** product and version as the title, labeled metadata (release
   date, channel or environment, previous version this describes changes
   from).
2. **Breaking changes and required actions** — first, whenever any exist.
   Each with: what breaks, who is affected, the migration step, and the
   deadline if one exists. When there are none, one line saying so; that
   line is the best news in the document and readers look for it.
3. **Highlights:** the two to four changes that matter most, each with a
   sentence of why the reader should care. Not a duplicate of the full
   list; a curation of it.
4. **Changes by area.** Grouped under the product's own area names, each
   entry one line: what changed, from the user's perspective. Added,
   changed, and fixed read differently; mark them consistently (words, not
   icon soup).
5. **Known issues:** what ships broken or incomplete, with workarounds
   when they exist. Present when true; never omitted to look clean.
6. **Footer metadata:** where to get it, where to report problems, link to
   the previous release's notes.

## Creation guidance

Write from the changelog, commit list, or tracker; never from memory of
what probably shipped. Every entry describes observable behavior ("CSV
export keeps column order"), not internals ("refactored exporter"). If the
release has real numbers (performance, limits), they appear in the entry
that earned them.

## Hierarchy contract

Breaking changes are visually the most prominent section when present;
highlights come second. The by-area list is dense and scannable: area
headings, one-line entries, consistent change markers. Nothing in release
notes is a hero moment; the register is a well-kept ledger.

## Mobile contract

First two phone screens: title, metadata, breaking changes (or the no-breaks
line) and the top of highlights. By-area entries wrap without separating
the change marker from the entry text.

## Review contract

Stable ids per SKILL.md § Review-ready contract, with the recurring-document
addition: section ids stay identical across releases
(`breaking-changes`, `highlights`, `changes-by-area`, `known-issues`), and
area subsections use stable area slugs. Each release is normally a new
document (one per version); a corrected release note is a new version of
that release's document.

## Failure modes

**Marketing register.** "We're thrilled to announce" in front of a bug-fix
list. The reader is checking whether their integration breaks; thrill is
noise.

**Internals as entries.** "Migrated to the new queue implementation" tells
the user nothing. What do they observe: faster? different limits? nothing
(then why is it listed)?

**Buried breakage.** A breaking change in the middle of the fixed list is
how integrators get burned and stop trusting the notes. Breaking changes
lead, always.

**Aspirational entries.** Listing what was supposed to ship. If it slipped,
it is not in the notes; if it half-shipped, it is in known issues.

**Icon-soup markers.** Emoji legends for added/changed/fixed/deprecated.
Words are unambiguous and survive every rendering context.

---
name: Audit
description: An assessment against named criteria: what was checked, what passed, what failed at which severity, and the remediation path.
---

# Audit

## Use when

Something was assessed against a defined bar (security posture, code
quality, accessibility, compliance, dependency licenses, a vendor's
claims) and the reader needs
to know where it stands, what is broken, how bad each item is, and what
fixing it takes.

## Do not use when

There is no defined bar; open-ended examination is a report. The reader
wants a go/no-go on future work; that is a proposal. The findings are
routine progress; that is a status update.

## Structure

1. **Header:** title, one-line subtitle naming what was audited and
   against what, labeled metadata (subject, criteria or standard, auditor,
   date, version of the thing audited).
2. **Verdict:** the overall standing in two or three sentences, with the
   counts (N critical, N major, N minor) and whether the subject passes
   the bar as of this audit. Never make the reader assemble the verdict
   from the findings themselves.
3. **Scope and criteria:** what was in scope, what was excluded and why,
   and the criteria applied. When the criteria are a named standard, name
   the version.
4. **Findings by severity.** Ordered critical first. Each finding carries:
   severity, where it lives (file, screen, process step), what was
   observed, why it matters against the criteria, and how to fix it.
   Severity definitions appear once, before the first finding.
5. **What passed:** areas checked and found sound, listed briefly. It
   scopes the reader's trust: silence is ambiguous, a pass list is not.
6. **Remediation plan:** the fixes as a table ordered by severity, each
   with effort class and suggested owner. When retest is expected, say
   what triggers it.

## Creation guidance

Severity comes from impact against the criteria, not from how interesting
the finding is. Each finding must be reproducible from its own text: where,
what, how observed. Use the style's status vocabulary for severity marks;
never tint whole rows.

## Hierarchy contract

The verdict is the strongest block after the title. Severity marks are
compact, textual, consistent; the page must not read as an alarm wall even
when the news is bad. Findings have identical internal anatomy so the
reader learns the rhythm at finding one.

## Mobile contract

First two phone screens: title, metadata, complete verdict, severity
definitions or the first critical finding. A finding's severity, location,
and observation stay together when wrapping; the remediation table keeps
fix and severity on one line.

## Review contract

Stable ids per SKILL.md § Review-ready contract. Each finding is its own
anchor point with an id derived from the finding's short name, not its
number ("missing-rate-limit-on-login", not "finding-7"), because findings
get renumbered when one is withdrawn. Re-audits are new versions of the
same document, keeping ids of findings that persist.

## Failure modes

**Verdict dodging.** Twenty findings and no overall standing. The auditor's
job includes the judgment; deliver it.

**Severity inflation.** Everything critical means nothing is. If a finding
would not change the reader's week, it is minor.

**Unreproducible findings.** "Auth is weak in places." Which place, which
observation, against which criterion.

**Silent scope.** The reader assumes something was checked that was not.
The exclusions list is honesty, not filler.

**Findings without fixes.** A named problem with no remediation is homework
handed back unfinished. Every finding pairs with a fix, even when the fix
is "decide X first".
